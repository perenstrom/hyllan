import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { households, pantryItems } from "@/db/schema";
import { deleteUserAccount } from "./account";

const TEST_USER_ID = "33333333-3333-3333-3333-333333333333";

describe("deleteUserAccount", () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  beforeAll(async () => {
    // GoTrue owns and migrates auth.users itself (src/db/schema/auth.ts) —
    // stub just enough of it here so the FK in our own migrations resolves.
    await client.exec(`
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      INSERT INTO auth.users (id) VALUES ('${TEST_USER_ID}');
    `);

    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it("cascades through the household to remove every pantry item when the owning user is deleted", async () => {
    const [household] = await db
      .insert(households)
      .values({ userId: TEST_USER_ID })
      .returning();

    await db.insert(pantryItems).values([
      { householdId: household.id, name: "Rice", quantity: "2", unit: "kg" },
      { householdId: household.id, name: "Eggs", quantity: "6" },
    ]);

    await deleteUserAccount(db, TEST_USER_ID);

    const remainingHouseholds = await db
      .select()
      .from(households)
      .where(eq(households.userId, TEST_USER_ID));
    expect(remainingHouseholds).toHaveLength(0);

    const remainingItems = await db
      .select()
      .from(pantryItems)
      .where(eq(pantryItems.householdId, household.id));
    expect(remainingItems).toHaveLength(0);
  });
});
