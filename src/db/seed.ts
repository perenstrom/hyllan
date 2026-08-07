// Dev-only convenience script — run with `npm run db:seed` against the
// local Docker Compose stack (`docker compose up -d` + `npm run db:migrate`
// first). Not used in production or CI.
//
// Creates one GoTrue account through the same `/signup` endpoint the app
// itself calls (README's next.config.ts rewrite note — standalone GoTrue
// has no Kong, so /auth/v1/* rewrites to GOTRUE_API_EXTERNAL_URL, meaning
// GOTRUE_API_EXTERNAL_URL/signup is the unprefixed endpoint), then reuses
// the app's own household/pantry-item helpers so seeded data goes through
// the exact same code paths as a real signup.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { createHouseholdForUser } from "@/lib/household";
import { addPantryItem, listPantryItems } from "@/lib/pantry-items";
import type { AddPantryItemInput } from "@/lib/pantry-items";

const DEV_EMAIL = "dev@example.com";
const DEV_PASSWORD = "development";

const SEED_ITEMS: AddPantryItemInput[] = [
  { name: "Rice", quantity: "2", unit: "kg", minimumQuantity: "1" },
  { name: "Olive oil", quantity: "1", unit: "l", minimumQuantity: null },
  {
    name: "Canned tomatoes",
    quantity: "4",
    unit: "count",
    minimumQuantity: null,
  },
  { name: "Pasta", quantity: "3", unit: "pack", minimumQuantity: null },
  { name: "Coffee", quantity: "500", unit: "g", minimumQuantity: "600" },
];

async function findOrCreateAuthUser(
  sql: postgres.Sql,
  email: string,
  password: string,
): Promise<string> {
  const existing = await sql`select id from auth.users where email = ${email}`;
  if (existing.length > 0) {
    return existing[0].id as string;
  }

  const gotrueUrl = process.env.GOTRUE_API_EXTERNAL_URL;
  if (!gotrueUrl) {
    throw new Error("GOTRUE_API_EXTERNAL_URL is not set");
  }

  const response = await fetch(`${gotrueUrl}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(
      `GoTrue signup failed: ${response.status} ${await response.text()}`,
    );
  }

  const created = await sql`select id from auth.users where email = ${email}`;
  if (created.length === 0) {
    throw new Error(
      "GoTrue reported a successful signup, but no matching auth.users row was found",
    );
  }

  return created[0].id as string;
}

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    throw new Error("No .env file found — run `cp .env.example .env` first");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(databaseUrl);
  const db = drizzle(sql, { schema });

  try {
    const userId = await findOrCreateAuthUser(sql, DEV_EMAIL, DEV_PASSWORD);
    const household = await createHouseholdForUser(db, userId);

    const items = await listPantryItems(db, household.id);
    if (items.length === 0) {
      for (const item of SEED_ITEMS) {
        await addPantryItem(db, household.id, item);
      }
      console.log(`Seeded ${SEED_ITEMS.length} pantry items.`);
    } else {
      console.log("Pantry items already present, skipping item seeding.");
    }

    console.log(`Dev account ready: ${DEV_EMAIL} / ${DEV_PASSWORD}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
