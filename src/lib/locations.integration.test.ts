import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { households, locations, pantryItems } from "@/db/schema";
import {
  addLocation,
  deleteLocation,
  DuplicateLocationNameError,
  listLocations,
  renameLocation,
} from "./locations";
import { addPantryItem, getPantryItem } from "./pantry-items";

const TEST_USER_ID = "77777777-7777-7777-7777-777777777777";

// Same stub-just-enough-of-GoTrue pattern as pantry-items.integration.test.ts.
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

describe("locations", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let householdId: string;

  beforeAll(async () => {
    ({ client, db, householdId } = await createTestDb());
  });

  beforeEach(async () => {
    await db.delete(locations);
  });

  afterAll(async () => {
    await client.close();
  });

  it("creates a location for the household", async () => {
    const location = await addLocation(db, householdId, "Pantry");

    expect(location).toMatchObject({ householdId, name: "Pantry" });

    const rows = await listLocations(db, householdId);
    expect(rows).toHaveLength(1);
  });

  it("rejects a name that already exists in the household, case-insensitively", async () => {
    await addLocation(db, householdId, "Pantry");

    await expect(addLocation(db, householdId, "pantry")).rejects.toThrow(
      DuplicateLocationNameError,
    );
  });

  it("does not fold names across different households", async () => {
    const [otherUser] = await db
      .insert(schema.authUsers)
      .values({ id: "88888888-8888-8888-8888-888888888888" })
      .returning();
    const [otherHousehold] = await db
      .insert(households)
      .values({ userId: otherUser.id })
      .returning();

    await addLocation(db, householdId, "Pantry");
    await expect(
      addLocation(db, otherHousehold.id, "Pantry"),
    ).resolves.toMatchObject({ name: "Pantry" });
  });

  it("lists locations for a household ordered by creation", async () => {
    await addLocation(db, householdId, "Pantry");
    await addLocation(db, householdId, "Garage fridge");

    const rows = await listLocations(db, householdId);
    expect(rows.map((row) => row.name)).toEqual(["Pantry", "Garage fridge"]);
  });

  it("renames a location", async () => {
    const location = await addLocation(db, householdId, "Pantry");

    const renamed = await renameLocation(
      db,
      householdId,
      location.id,
      "Kitchen pantry",
    );

    expect(renamed?.name).toBe("Kitchen pantry");
  });

  it("rejects a rename that collides with another location's name", async () => {
    await addLocation(db, householdId, "Pantry");
    const freezer = await addLocation(db, householdId, "Freezer");

    await expect(
      renameLocation(db, householdId, freezer.id, "pantry"),
    ).rejects.toThrow(DuplicateLocationNameError);
  });

  it("does not rename a location belonging to a different household", async () => {
    const [otherUser] = await db
      .insert(schema.authUsers)
      .values({ id: "99999999-9999-9999-9999-999999999999" })
      .returning();
    const [otherHousehold] = await db
      .insert(households)
      .values({ userId: otherUser.id })
      .returning();
    const location = await addLocation(db, otherHousehold.id, "Pantry");

    const renamed = await renameLocation(
      db,
      householdId,
      location.id,
      "Hijacked",
    );

    expect(renamed).toBeUndefined();
  });
});

describe("deleteLocation", () => {
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

  it("merges the location's quantity back into each item's unassigned bucket", async () => {
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

    const deleted = await deleteLocation(db, householdId, pantry.id);

    expect(deleted?.id).toBe(pantry.id);

    const refreshed = await getPantryItem(db, householdId, item.id);
    expect(refreshed?.quantity).toBe("7");
    expect(refreshed?.buckets).toEqual([
      expect.objectContaining({ locationId: null, quantity: "7" }),
    ]);
  });

  it("merges into a new unassigned bucket when the item didn't have one yet", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "3",
      unit: "kg",
      locationId: pantry.id,
    });

    await deleteLocation(db, householdId, pantry.id);

    const refreshed = await getPantryItem(db, householdId, item.id);
    expect(refreshed?.quantity).toBe("3");
    expect(refreshed?.buckets).toEqual([
      expect.objectContaining({ locationId: null, quantity: "3" }),
    ]);
  });

  it("removes the location itself", async () => {
    const pantry = await addLocation(db, householdId, "Pantry");

    await deleteLocation(db, householdId, pantry.id);

    const rows = await listLocations(db, householdId);
    expect(rows).toHaveLength(0);
  });

  it("does not delete a location belonging to a different household", async () => {
    const [otherUser] = await db
      .insert(schema.authUsers)
      .values({ id: "10101010-1010-1010-1010-101010101010" })
      .returning();
    const [otherHousehold] = await db
      .insert(households)
      .values({ userId: otherUser.id })
      .returning();
    const location = await addLocation(db, otherHousehold.id, "Pantry");

    const deleted = await deleteLocation(db, householdId, location.id);

    expect(deleted).toBeUndefined();
    const rows = await listLocations(db, otherHousehold.id);
    expect(rows).toHaveLength(1);
  });
});
