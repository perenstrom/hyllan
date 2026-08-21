import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { households, itemLocations, locations, pantryItems } from "@/db/schema";
import { addLocation } from "./locations";
import {
  addPantryItem,
  decrementPantryItemQuantity,
  deletePantryItem,
  DuplicatePantryItemNameError,
  getPantryItem,
  incrementPantryItemQuantity,
  listPantryItems,
  PantryItemUnitMismatchError,
  setPantryItemLocationQuantity,
  updatePantryItem,
} from "./pantry-items";

const TEST_USER_ID = "22222222-2222-2222-2222-222222222222";

// GoTrue owns and migrates auth.users itself — stub just enough of it here
// so the FK in our own migrations resolves (see
// household.integration.test.ts for the same pattern).
async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await client.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    INSERT INTO auth.users (id) VALUES ('${TEST_USER_ID}');
  `);

  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });

  const [household] = await db
    .insert(households)
    .values({ userId: TEST_USER_ID })
    .returning();

  return { client, db, householdId: household.id };
}

describe("pantry-items", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let householdId: string;

  beforeAll(async () => {
    ({ client, db, householdId } = await createTestDb());
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

  it("creates a new row for a name the household doesn't already track, in the implicit unassigned bucket by default", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    expect(item).toMatchObject({ name: "Rice", quantity: "2", unit: "kg" });
    expect(item.buckets).toEqual([
      expect.objectContaining({ locationId: null, quantity: "2" }),
    ]);

    const rows = await listPantryItems(db, householdId);
    expect(rows).toHaveLength(1);
  });

  it("creates the item's quantity at the given location instead of unassigned", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");

    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
      locationId: pantry.id,
    });

    expect(item.quantity).toBe("2");
    expect(item.buckets).toEqual([
      expect.objectContaining({
        locationId: pantry.id,
        locationName: "Pantry",
        quantity: "2",
      }),
    ]);
  });

  it("increments the existing row's total when the name matches case-insensitively", async () => {
    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const incremented = await addPantryItem(db, householdId, {
      name: "RICE",
      quantity: "1.5",
      unit: "kg",
    });

    expect(incremented.quantity).toBe("3.5");

    const rows = await listPantryItems(db, householdId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Rice");
  });

  it("adds a second add at a different location as its own bucket, without touching the first", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");

    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "1",
      unit: "kg",
      locationId: pantry.id,
    });

    expect(item.quantity).toBe("3");
    expect(item.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locationId: null, quantity: "2" }),
        expect.objectContaining({ locationId: pantry.id, quantity: "1" }),
      ]),
    );
  });

  it("rejects the add when the name matches but the unit differs, leaving the existing item unchanged", async () => {
    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    await expect(
      addPantryItem(db, householdId, {
        name: "RICE",
        quantity: "3",
        unit: "bag",
      }),
    ).rejects.toThrow(PantryItemUnitMismatchError);

    const rows = await listPantryItems(db, householdId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Rice", quantity: "2", unit: "kg" });
  });

  it("names the existing item's name and unit on the mismatch error", async () => {
    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    await expect(
      addPantryItem(db, householdId, {
        name: "rice",
        quantity: "3",
        unit: "bag",
      }),
    ).rejects.toMatchObject({ itemName: "Rice", unit: "kg" });
  });

  it("still enforces the unit-match check when two adds under a brand-new name race for the insert", async () => {
    const [a, b] = await Promise.allSettled([
      addPantryItem(db, householdId, {
        name: "Oats",
        quantity: "2",
        unit: "kg",
      }),
      addPantryItem(db, householdId, {
        name: "Oats",
        quantity: "3",
        unit: "bag",
      }),
    ]);

    // Whichever add wins the race gets inserted; the loser retries as a
    // merge against a differently-unit'd row and must still be rejected
    // rather than silently summed — so exactly one of the two survives.
    const succeeded =
      a.status === "fulfilled" ? a : b.status === "fulfilled" ? b : null;
    const failed =
      a.status === "rejected" ? a : b.status === "rejected" ? b : null;
    if (!succeeded || !failed) {
      throw new Error("expected exactly one add to succeed and one to fail");
    }

    expect(failed.reason).toBeInstanceOf(PantryItemUnitMismatchError);

    const rows = await listPantryItems(db, householdId);
    const oats = rows.filter((row) => row.name === "Oats");
    expect(oats).toHaveLength(1);
    expect(oats[0].quantity).toBe(succeeded.value.quantity);
  });

  it("does not fold names for a different household", async () => {
    const [otherUser] = await db
      .insert(schema.authUsers)
      .values({ id: "33333333-3333-3333-3333-333333333333" })
      .returning();
    const [otherHousehold] = await db
      .insert(households)
      .values({ userId: otherUser.id })
      .returning();

    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });
    await addPantryItem(db, otherHousehold.id, {
      name: "Rice",
      quantity: "5",
      unit: "kg",
    });

    const rows = await listPantryItems(db, householdId);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe("2");
  });

  it("enforces the (household_id, lower(name)) uniqueness constraint at the database level", async () => {
    await db
      .insert(pantryItems)
      .values({ householdId, name: "Rice", unit: "kg" });

    await expect(
      db.insert(pantryItems).values({ householdId, name: "RICE", unit: "kg" }),
    ).rejects.toThrow();
  });

  it("persists a minimum quantity when provided", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
      minimumQuantity: "1",
    });

    expect(item.minimumQuantity).toBe("1");
  });

  it("leaves minimum quantity null when omitted", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    expect(item.minimumQuantity).toBeNull();
  });

  it("does not change an existing item's minimum quantity when a same-name-and-unit add merges into it", async () => {
    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
      minimumQuantity: "1",
    });

    const merged = await addPantryItem(db, householdId, {
      name: "RICE",
      quantity: "1",
      unit: "kg",
    });

    expect(merged.quantity).toBe("3");
    expect(merged.minimumQuantity).toBe("1");
  });

  it("enforces the minimum-quantity non-negative check constraint at the database level", async () => {
    await expect(
      db.insert(pantryItems).values({
        householdId,
        name: "Rice",
        unit: "kg",
        minimumQuantity: "-1",
      }),
    ).rejects.toThrow();
  });

  it("lists items for a household ordered by creation", async () => {
    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "1",
      unit: "kg",
    });
    await addPantryItem(db, householdId, {
      name: "Beans",
      quantity: "1",
      unit: "kg",
    });

    const rows = await listPantryItems(db, householdId);
    expect(rows.map((row) => row.name)).toEqual(["Rice", "Beans"]);
  });
});

describe("incrementPantryItemQuantity / decrementPantryItemQuantity", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let householdId: string;

  beforeAll(async () => {
    ({ client, db, householdId } = await createTestDb());
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

  it("increments the unassigned bucket of a single-bucket item", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const updated = await incrementPantryItemQuantity(
      db,
      householdId,
      item.id,
      null,
    );

    expect(updated?.quantity).toBe("3");
  });

  it("decrements the unassigned bucket of a single-bucket item", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const updated = await decrementPantryItemQuantity(
      db,
      householdId,
      item.id,
      null,
    );

    expect(updated?.quantity).toBe("1");
  });

  it("floors a decrement at zero at the database level too", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "0",
      unit: "kg",
    });

    const updated = await decrementPantryItemQuantity(
      db,
      householdId,
      item.id,
      null,
    );

    expect(updated?.quantity).toBe("0");
  });

  it("adjusts only the targeted location's bucket, leaving others untouched", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });
    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "5",
      unit: "kg",
      locationId: pantry.id,
    });

    await incrementPantryItemQuantity(db, householdId, item.id, pantry.id);

    const [unassignedBucket] = await db
      .select()
      .from(itemLocations)
      .where(eq(itemLocations.locationId, pantry.id));
    expect(unassignedBucket.quantity).toBe("6");

    const refreshed = await getPantryItem(db, householdId, item.id);
    expect(refreshed?.quantity).toBe("8");
  });

  it("returns undefined when the targeted bucket doesn't exist", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const updated = await incrementPantryItemQuantity(
      db,
      householdId,
      item.id,
      pantry.id,
    );

    expect(updated).toBeUndefined();
  });

  it("does not adjust an item belonging to a different household", async () => {
    const [otherUser] = await db
      .insert(schema.authUsers)
      .values({ id: "44444444-4444-4444-4444-444444444444" })
      .returning();
    const [otherHousehold] = await db
      .insert(households)
      .values({ userId: otherUser.id })
      .returning();

    const item = await addPantryItem(db, otherHousehold.id, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const updated = await incrementPantryItemQuantity(
      db,
      householdId,
      item.id,
      null,
    );

    expect(updated).toBeUndefined();
  });
});

describe("updatePantryItem", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let householdId: string;

  beforeAll(async () => {
    ({ client, db, householdId } = await createTestDb());
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

  it("updates name, quantity, and unit", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const updated = await updatePantryItem(db, householdId, item.id, {
      name: "Basmati rice",
      quantity: "5",
      unit: "g",
    });

    expect(updated).toMatchObject({
      name: "Basmati rice",
      quantity: "5",
      unit: "g",
    });
  });

  it("sets the targeted bucket absolutely, without touching other buckets, when the location is unchanged", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });
    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "5",
      unit: "kg",
      locationId: pantry.id,
    });

    const updated = await updatePantryItem(db, householdId, item.id, {
      name: "Rice",
      quantity: "9",
      unit: "kg",
      locationId: pantry.id,
      originalLocationId: pantry.id,
    });

    expect(updated?.quantity).toBe("11"); // 2 (unassigned, untouched) + 9
    expect(updated?.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locationId: null, quantity: "2" }),
        expect.objectContaining({ locationId: pantry.id, quantity: "9" }),
      ]),
    );
  });

  it("moves the targeted bucket to a new, previously-empty location, without touching other buckets", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");
    const garage = await addLocation(db, householdId, "Garage fridge");
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });
    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "5",
      unit: "kg",
      locationId: pantry.id,
    });

    // Editing the Pantry bucket (originalLocationId) but assigning it to
    // Garage fridge (locationId) — a relocation, not a second add.
    const updated = await updatePantryItem(db, householdId, item.id, {
      name: "Rice",
      quantity: "9",
      unit: "kg",
      locationId: garage.id,
      originalLocationId: pantry.id,
    });

    expect(updated?.quantity).toBe("11"); // 2 (unassigned, untouched) + 9
    expect(updated?.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locationId: null, quantity: "2" }),
        expect.objectContaining({ locationId: garage.id, quantity: "9" }),
      ]),
    );
    expect(
      updated?.buckets.some((bucket) => bucket.locationId === pantry.id),
    ).toBe(false);
  });

  it("moves the unassigned bucket to a location when editing a single-bucket item's location", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const updated = await updatePantryItem(db, householdId, item.id, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
      locationId: pantry.id,
      originalLocationId: null,
    });

    expect(updated?.quantity).toBe("2");
    expect(updated?.buckets).toEqual([
      expect.objectContaining({ locationId: pantry.id, quantity: "2" }),
    ]);
  });

  it("updates the minimum quantity", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
      minimumQuantity: "1",
    });

    const updated = await updatePantryItem(db, householdId, item.id, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
      minimumQuantity: "3",
    });

    expect(updated?.minimumQuantity).toBe("3");
  });

  it("clears the minimum quantity when the update omits it", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
      minimumQuantity: "1",
    });

    const updated = await updatePantryItem(db, householdId, item.id, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    expect(updated?.minimumQuantity).toBeNull();
  });

  it("throws a DuplicatePantryItemNameError when the new name collides with another item", async () => {
    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });
    const beans = await addPantryItem(db, householdId, {
      name: "Beans",
      quantity: "1",
      unit: "kg",
    });

    await expect(
      updatePantryItem(db, householdId, beans.id, {
        name: "rice",
        quantity: "1",
        unit: "kg",
      }),
    ).rejects.toThrow(DuplicatePantryItemNameError);
  });

  it("does not update an item belonging to a different household", async () => {
    const [otherUser] = await db
      .insert(schema.authUsers)
      .values({ id: "55555555-5555-5555-5555-555555555555" })
      .returning();
    const [otherHousehold] = await db
      .insert(households)
      .values({ userId: otherUser.id })
      .returning();

    const item = await addPantryItem(db, otherHousehold.id, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const updated = await updatePantryItem(db, householdId, item.id, {
      name: "Hijacked",
      quantity: "1",
      unit: "kg",
    });

    expect(updated).toBeUndefined();
  });
});

describe("setPantryItemLocationQuantity", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let householdId: string;

  beforeAll(async () => {
    ({ client, db, householdId } = await createTestDb());
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

  it("sets the targeted bucket to the given absolute value", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
      locationId: pantry.id,
    });

    const updated = await setPantryItemLocationQuantity(
      db,
      householdId,
      item.id,
      pantry.id,
      "7",
    );

    expect(updated?.quantity).toBe("7");
    expect(updated?.buckets).toEqual([
      expect.objectContaining({ locationId: pantry.id, quantity: "7" }),
    ]);
  });

  it("overwrites rather than adds to the existing value", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "10",
      unit: "kg",
      locationId: pantry.id,
    });

    const updated = await setPantryItemLocationQuantity(
      db,
      householdId,
      item.id,
      pantry.id,
      "1",
    );

    expect(updated?.quantity).toBe("1");
  });

  it("creates the bucket when the item has no row at that location yet", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const updated = await setPantryItemLocationQuantity(
      db,
      householdId,
      item.id,
      pantry.id,
      "4",
    );

    expect(updated?.quantity).toBe("6"); // 2 (unassigned, untouched) + 4
    expect(updated?.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locationId: null, quantity: "2" }),
        expect.objectContaining({ locationId: pantry.id, quantity: "4" }),
      ]),
    );
  });

  it("does not touch the item's other buckets", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");
    const garage = await addLocation(db, householdId, "Garage fridge");
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
      locationId: pantry.id,
    });
    await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "5",
      unit: "kg",
      locationId: garage.id,
    });

    await setPantryItemLocationQuantity(
      db,
      householdId,
      item.id,
      pantry.id,
      "9",
    );

    const refreshed = await getPantryItem(db, householdId, item.id);
    expect(refreshed?.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locationId: garage.id, quantity: "5" }),
      ]),
    );
  });

  it("allows setting the bucket to zero", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
      locationId: pantry.id,
    });

    const updated = await setPantryItemLocationQuantity(
      db,
      householdId,
      item.id,
      pantry.id,
      "0",
    );

    expect(updated?.quantity).toBe("0");
  });

  it("returns undefined when the item belongs to a different household", async () => {
    const [otherUser] = await db
      .insert(schema.authUsers)
      .values({ id: "77777777-7777-7777-7777-777777777777" })
      .returning();
    const [otherHousehold] = await db
      .insert(households)
      .values({ userId: otherUser.id })
      .returning();
    const pantry = await addLocation(db, householdId, "Pantry");

    const item = await addPantryItem(db, otherHousehold.id, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const updated = await setPantryItemLocationQuantity(
      db,
      householdId,
      item.id,
      pantry.id,
      "9",
    );

    expect(updated).toBeUndefined();
  });
});

describe("deletePantryItem", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let householdId: string;

  beforeAll(async () => {
    ({ client, db, householdId } = await createTestDb());
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

  it("removes the item entirely, cascading to its location buckets", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const deleted = await deletePantryItem(db, householdId, item.id);

    expect(deleted?.id).toBe(item.id);
    expect(await getPantryItem(db, householdId, item.id)).toBeUndefined();

    const remainingBuckets = await db
      .select()
      .from(itemLocations)
      .where(eq(itemLocations.pantryItemId, item.id));
    expect(remainingBuckets).toHaveLength(0);
  });

  it("does not delete an item belonging to a different household", async () => {
    const [otherUser] = await db
      .insert(schema.authUsers)
      .values({ id: "66666666-6666-6666-6666-666666666666" })
      .returning();
    const [otherHousehold] = await db
      .insert(households)
      .values({ userId: otherUser.id })
      .returning();

    const item = await addPantryItem(db, otherHousehold.id, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const deleted = await deletePantryItem(db, householdId, item.id);

    expect(deleted).toBeUndefined();
    expect(await getPantryItem(db, otherHousehold.id, item.id)).toBeDefined();
  });
});
