import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { households, itemLocations, locations, pantryItems } from "@/db/schema";
import {
  adjustBucket,
  fetchItemQuantities,
  foldLocationBuckets,
  relocateBucket,
  setBucket,
} from "./quantity";

const TEST_USER_ID = "12121212-1212-1212-1212-121212121212";
const OTHER_USER_ID = "13131313-1313-1313-1313-131313131313";

// Same stub-just-enough-of-GoTrue pattern as pantry-items.integration.test.ts,
// plus a second household for the scoping cases.
async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await client.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    INSERT INTO auth.users (id) VALUES ('${TEST_USER_ID}'), ('${OTHER_USER_ID}');
  `);

  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });

  const [household, otherHousehold] = await db
    .insert(households)
    .values([{ userId: TEST_USER_ID }, { userId: OTHER_USER_ID }])
    .returning();

  return {
    client,
    db,
    householdId: household.id,
    otherHouseholdId: otherHousehold.id,
  };
}

describe("quantity", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let householdId: string;
  let otherHouseholdId: string;

  // Seeds an item and its bucket rows directly, so these tests exercise
  // only the Quantity module's own interface.
  async function createItem(
    buckets: { locationId: string | null; quantity: string }[],
    owner = householdId,
  ) {
    const [item] = await db
      .insert(pantryItems)
      .values({
        householdId: owner,
        name: `Item ${crypto.randomUUID()}`,
        unit: "kg",
      })
      .returning();
    if (buckets.length > 0) {
      await db
        .insert(itemLocations)
        .values(
          buckets.map((bucket) => ({ ...bucket, pantryItemId: item.id })),
        );
    }
    return item;
  }

  async function createLocation(name: string, owner = householdId) {
    const [location] = await db
      .insert(locations)
      .values({ householdId: owner, name })
      .returning();
    return location;
  }

  async function bucketsOf(itemId: string) {
    return (await fetchItemQuantities(db, [itemId])).get(itemId)?.buckets ?? [];
  }

  beforeAll(async () => {
    ({ client, db, householdId, otherHouseholdId } = await createTestDb());
  });

  beforeEach(async () => {
    // pantryItems first — deleting it cascades away any item_locations rows
    // still pointing at a location, so locations can be cleared cleanly
    // afterward.
    await db.delete(pantryItems);
    await db.delete(locations);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("adjustBucket", () => {
    it("adds a positive delta, reporting the delta applied and the new total", async () => {
      const item = await createItem([{ locationId: null, quantity: "2" }]);

      const result = await adjustBucket(db, householdId, item.id, null, "3");

      expect(result).toEqual({
        appliedDelta: "3",
        total: "5",
        buckets: [{ locationId: null, locationName: null, quantity: "5" }],
      });
    });

    it("floors a removal at zero, reporting only the amount actually removed", async () => {
      const item = await createItem([{ locationId: null, quantity: "2" }]);

      const result = await adjustBucket(db, householdId, item.id, null, "-5");

      expect(result?.appliedDelta).toBe("-2");
      expect(result?.total).toBe("0");
    });

    it("keeps decimal quantities exact", async () => {
      const item = await createItem([{ locationId: null, quantity: "0.1" }]);

      const result = await adjustBucket(db, householdId, item.id, null, "0.2");

      expect(result?.appliedDelta).toBe("0.2");
      expect(result?.total).toBe("0.3");
    });

    it("steps a decimal bucket by one without drifting", async () => {
      const item = await createItem([{ locationId: null, quantity: "0.3" }]);

      const result = await adjustBucket(db, householdId, item.id, null, "-1");
      const back = await adjustBucket(db, householdId, item.id, null, "1.1");

      expect(result?.total).toBe("0");
      expect(back?.total).toBe("1.1");
    });

    it("creates a missing bucket on a positive delta, leaving other buckets untouched", async () => {
      const pantry = await createLocation("Pantry");
      const item = await createItem([{ locationId: pantry.id, quantity: "4" }]);

      const result = await adjustBucket(db, householdId, item.id, null, "1");

      expect(result?.appliedDelta).toBe("1");
      expect(result?.total).toBe("5");
      expect(result?.buckets).toEqual(
        expect.arrayContaining([
          { locationId: pantry.id, locationName: "Pantry", quantity: "4" },
          { locationId: null, locationName: null, quantity: "1" },
        ]),
      );
    });

    it("creates nothing on a negative delta against a missing bucket", async () => {
      const pantry = await createLocation("Pantry");
      const item = await createItem([{ locationId: pantry.id, quantity: "4" }]);

      const result = await adjustBucket(db, householdId, item.id, null, "-1");

      expect(result?.appliedDelta).toBe("0");
      expect(result?.total).toBe("4");
      expect(await bucketsOf(item.id)).toHaveLength(1);
    });

    it("adjusts only the addressed Location's bucket", async () => {
      const pantry = await createLocation("Pantry");
      const item = await createItem([
        { locationId: null, quantity: "2" },
        { locationId: pantry.id, quantity: "5" },
      ]);

      const result = await adjustBucket(
        db,
        householdId,
        item.id,
        pantry.id,
        "1",
      );

      expect(result?.total).toBe("8");
      expect(result?.buckets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ locationId: null, quantity: "2" }),
          expect.objectContaining({ locationId: pantry.id, quantity: "6" }),
        ]),
      );
    });

    it("doesn't lose updates when adjusts on the same bucket run concurrently", async () => {
      const item = await createItem([{ locationId: null, quantity: "0" }]);

      await Promise.all(
        Array.from({ length: 10 }, () =>
          adjustBucket(db, householdId, item.id, null, "1"),
        ),
      );

      expect(await bucketsOf(item.id)).toEqual([
        expect.objectContaining({ locationId: null, quantity: "10" }),
      ]);
    });

    it("doesn't double-insert a missing bucket when concurrent adds race to create it", async () => {
      const pantry = await createLocation("Pantry");
      const item = await createItem([{ locationId: pantry.id, quantity: "1" }]);

      await Promise.all(
        Array.from({ length: 5 }, () =>
          adjustBucket(db, householdId, item.id, null, "1"),
        ),
      );

      expect(await bucketsOf(item.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ locationId: null, quantity: "5" }),
        ]),
      );
    });

    it("returns undefined for an item outside the household, leaving it untouched", async () => {
      const item = await createItem(
        [{ locationId: null, quantity: "2" }],
        otherHouseholdId,
      );

      const result = await adjustBucket(db, householdId, item.id, null, "1");

      expect(result).toBeUndefined();
      expect(await bucketsOf(item.id)).toEqual([
        expect.objectContaining({ quantity: "2" }),
      ]);
    });
  });

  describe("setBucket", () => {
    it("overwrites the addressed bucket rather than adding to it", async () => {
      const pantry = await createLocation("Pantry");
      const item = await createItem([
        { locationId: pantry.id, quantity: "10" },
      ]);

      const result = await setBucket(db, householdId, item.id, pantry.id, "1");

      expect(result).toEqual({
        total: "1",
        buckets: [
          { locationId: pantry.id, locationName: "Pantry", quantity: "1" },
        ],
      });
    });

    it("creates a missing bucket, even at zero", async () => {
      const pantry = await createLocation("Pantry");
      const item = await createItem([{ locationId: null, quantity: "2" }]);

      const result = await setBucket(db, householdId, item.id, pantry.id, "0");

      expect(result?.total).toBe("2");
      expect(result?.buckets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ locationId: null, quantity: "2" }),
          expect.objectContaining({ locationId: pantry.id, quantity: "0" }),
        ]),
      );
    });

    it("gives a brand-new item with no rows its first bucket", async () => {
      const item = await createItem([]);

      const result = await setBucket(db, householdId, item.id, null, "0");

      expect(result?.buckets).toEqual([
        { locationId: null, locationName: null, quantity: "0" },
      ]);
    });

    it("does not touch the item's other buckets", async () => {
      const pantry = await createLocation("Pantry");
      const garage = await createLocation("Garage fridge");
      const item = await createItem([
        { locationId: pantry.id, quantity: "2" },
        { locationId: garage.id, quantity: "5" },
      ]);

      const result = await setBucket(db, householdId, item.id, pantry.id, "9");

      expect(result?.total).toBe("14");
      expect(result?.buckets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ locationId: garage.id, quantity: "5" }),
        ]),
      );
    });

    it("returns undefined for an item outside the household", async () => {
      const item = await createItem(
        [{ locationId: null, quantity: "2" }],
        otherHouseholdId,
      );

      expect(
        await setBucket(db, householdId, item.id, null, "9"),
      ).toBeUndefined();
      expect(await bucketsOf(item.id)).toEqual([
        expect.objectContaining({ quantity: "2" }),
      ]);
    });
  });

  describe("relocateBucket", () => {
    it("moves the amount to an empty Location, removing the source row", async () => {
      const pantry = await createLocation("Pantry");
      const garage = await createLocation("Garage fridge");
      const item = await createItem([
        { locationId: null, quantity: "2" },
        { locationId: pantry.id, quantity: "5" },
      ]);

      const result = await relocateBucket(
        db,
        householdId,
        item.id,
        pantry.id,
        garage.id,
        "9",
      );

      expect(result?.total).toBe("11");
      expect(result?.buckets).toHaveLength(2);
      expect(result?.buckets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ locationId: null, quantity: "2" }),
          expect.objectContaining({ locationId: garage.id, quantity: "9" }),
        ]),
      );
    });

    it("adds to whatever an occupied target Location already holds", async () => {
      const pantry = await createLocation("Pantry");
      const garage = await createLocation("Garage");
      const item = await createItem([
        { locationId: pantry.id, quantity: "2" },
        { locationId: garage.id, quantity: "3" },
      ]);

      const result = await relocateBucket(
        db,
        householdId,
        item.id,
        pantry.id,
        garage.id,
        "2",
      );

      expect(result).toEqual({
        total: "5",
        buckets: [
          { locationId: garage.id, locationName: "Garage", quantity: "5" },
        ],
      });
    });

    it("adds to an existing unassigned bucket when moved to Unassigned", async () => {
      const pantry = await createLocation("Pantry");
      const item = await createItem([
        { locationId: null, quantity: "1.5" },
        { locationId: pantry.id, quantity: "2.25" },
      ]);

      const result = await relocateBucket(
        db,
        householdId,
        item.id,
        pantry.id,
        null,
        "2.25",
      );

      expect(result).toEqual({
        total: "3.75",
        buckets: [{ locationId: null, locationName: null, quantity: "3.75" }],
      });
    });

    it("moves the unassigned bucket onto a Location", async () => {
      const pantry = await createLocation("Pantry");
      const item = await createItem([{ locationId: null, quantity: "2" }]);

      const result = await relocateBucket(
        db,
        householdId,
        item.id,
        null,
        pantry.id,
        "2",
      );

      expect(result?.buckets).toEqual([
        { locationId: pantry.id, locationName: "Pantry", quantity: "2" },
      ]);
    });

    it("behaves as a set when source and target are the same", async () => {
      const pantry = await createLocation("Pantry");
      const item = await createItem([
        { locationId: null, quantity: "2" },
        { locationId: pantry.id, quantity: "5" },
      ]);

      const result = await relocateBucket(
        db,
        householdId,
        item.id,
        pantry.id,
        pantry.id,
        "9",
      );

      expect(result?.total).toBe("11");
      expect(result?.buckets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ locationId: null, quantity: "2" }),
          expect.objectContaining({ locationId: pantry.id, quantity: "9" }),
        ]),
      );
    });

    it("returns undefined for an item outside the household, leaving it untouched", async () => {
      const pantry = await createLocation("Pantry", otherHouseholdId);
      const item = await createItem(
        [{ locationId: null, quantity: "2" }],
        otherHouseholdId,
      );

      const result = await relocateBucket(
        db,
        householdId,
        item.id,
        null,
        pantry.id,
        "2",
      );

      expect(result).toBeUndefined();
      expect(await bucketsOf(item.id)).toEqual([
        expect.objectContaining({ locationId: null, quantity: "2" }),
      ]);
    });
  });

  describe("foldLocationBuckets", () => {
    it("merges each item's bucket at the Location into its unassigned bucket", async () => {
      const pantry = await createLocation("Pantry");
      const rice = await createItem([
        { locationId: null, quantity: "2" },
        { locationId: pantry.id, quantity: "5" },
      ]);
      const beans = await createItem([
        { locationId: pantry.id, quantity: "3" },
      ]);

      expect(await foldLocationBuckets(db, householdId, pantry.id)).toBe(true);

      expect(await bucketsOf(rice.id)).toEqual([
        expect.objectContaining({ locationId: null, quantity: "7" }),
      ]);
      expect(await bucketsOf(beans.id)).toEqual([
        expect.objectContaining({ locationId: null, quantity: "3" }),
      ]);
    });

    it("folds zero rows too, so an item whose only bucket was there keeps a row", async () => {
      const pantry = await createLocation("Pantry");
      const item = await createItem([{ locationId: pantry.id, quantity: "0" }]);

      await foldLocationBuckets(db, householdId, pantry.id);

      expect(await bucketsOf(item.id)).toEqual([
        expect.objectContaining({ locationId: null, quantity: "0" }),
      ]);
    });

    it("leaves no rows at the folded Location and doesn't touch other Locations", async () => {
      const pantry = await createLocation("Pantry");
      const garage = await createLocation("Garage");
      const item = await createItem([
        { locationId: pantry.id, quantity: "1" },
        { locationId: garage.id, quantity: "4" },
      ]);

      await foldLocationBuckets(db, householdId, pantry.id);

      const rowsAtPantry = await db
        .select()
        .from(itemLocations)
        .where(eq(itemLocations.locationId, pantry.id));
      expect(rowsAtPantry).toHaveLength(0);
      expect(await bucketsOf(item.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ locationId: garage.id, quantity: "4" }),
          expect.objectContaining({ locationId: null, quantity: "1" }),
        ]),
      );
    });

    it("returns false for a Location outside the household, leaving its buckets alone", async () => {
      const pantry = await createLocation("Pantry", otherHouseholdId);
      const item = await createItem(
        [{ locationId: pantry.id, quantity: "3" }],
        otherHouseholdId,
      );

      expect(await foldLocationBuckets(db, householdId, pantry.id)).toBe(false);
      expect(await bucketsOf(item.id)).toEqual([
        expect.objectContaining({ locationId: pantry.id, quantity: "3" }),
      ]);
    });
  });
});
