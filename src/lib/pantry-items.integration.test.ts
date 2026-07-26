import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { households, pantryItems } from "@/db/schema";
import {
  addPantryItem,
  decrementPantryItemQuantity,
  deletePantryItem,
  DuplicatePantryItemNameError,
  getPantryItem,
  incrementPantryItemQuantity,
  listPantryItems,
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
    await db.delete(pantryItems);
  });

  afterAll(async () => {
    await client.close();
  });

  it("creates a new row for a name the household doesn't already track", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    expect(item).toMatchObject({ name: "Rice", quantity: "2", unit: "kg" });

    const rows = await listPantryItems(db, householdId);
    expect(rows).toHaveLength(1);
  });

  it("increments the existing row when the name matches case-insensitively", async () => {
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
      .values({ householdId, name: "Rice", quantity: "1", unit: "kg" });

    await expect(
      db
        .insert(pantryItems)
        .values({ householdId, name: "RICE", quantity: "1", unit: "kg" }),
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
    await db.delete(pantryItems);
  });

  afterAll(async () => {
    await client.close();
  });

  it("increments the quantity of an item scoped to the household", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const updated = await incrementPantryItemQuantity(
      db,
      householdId,
      item.id,
    );

    expect(updated?.quantity).toBe("3");
  });

  it("decrements the quantity of an item scoped to the household", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const updated = await decrementPantryItemQuantity(
      db,
      householdId,
      item.id,
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
    );

    expect(updated?.quantity).toBe("0");
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
    await db.delete(pantryItems);
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

describe("deletePantryItem", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let householdId: string;

  beforeAll(async () => {
    ({ client, db, householdId } = await createTestDb());
  });

  beforeEach(async () => {
    await db.delete(pantryItems);
  });

  afterAll(async () => {
    await client.close();
  });

  it("removes the item entirely", async () => {
    const item = await addPantryItem(db, householdId, {
      name: "Rice",
      quantity: "2",
      unit: "kg",
    });

    const deleted = await deletePantryItem(db, householdId, item.id);

    expect(deleted?.id).toBe(item.id);
    expect(await getPantryItem(db, householdId, item.id)).toBeUndefined();
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
