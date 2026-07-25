import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { households, pantryItems } from "@/db/schema";
import { addPantryItem, listPantryItems } from "./pantry-items";

const TEST_USER_ID = "22222222-2222-2222-2222-222222222222";

describe("pantry-items", () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  let householdId: string;

  beforeAll(async () => {
    // GoTrue owns and migrates auth.users itself — stub just enough of it
    // here so the FK in our own migrations resolves (see
    // household.integration.test.ts for the same pattern).
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
    householdId = household.id;
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
