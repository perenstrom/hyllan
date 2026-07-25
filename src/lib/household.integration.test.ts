import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { households } from "@/db/schema";
import { createHouseholdForUser } from "./household";

const TEST_USER_ID = "11111111-1111-1111-1111-111111111111";

describe("createHouseholdForUser", () => {
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

  it("creates a household row for the user", async () => {
    const household = await createHouseholdForUser(db, TEST_USER_ID);

    expect(household).toMatchObject({ userId: TEST_USER_ID });

    const rows = await db
      .select()
      .from(households)
      .where(eq(households.userId, TEST_USER_ID));
    expect(rows).toHaveLength(1);
  });

  it("is idempotent — a retry does not create a second household", async () => {
    const first = await createHouseholdForUser(db, TEST_USER_ID);
    const second = await createHouseholdForUser(db, TEST_USER_ID);

    expect(second.id).toBe(first.id);

    const rows = await db
      .select()
      .from(households)
      .where(eq(households.userId, TEST_USER_ID));
    expect(rows).toHaveLength(1);
  });

  it("enforces one household per user at the database level", async () => {
    await expect(
      db.insert(households).values({ userId: TEST_USER_ID }),
    ).rejects.toThrow();
  });
});
