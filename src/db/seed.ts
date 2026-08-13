// Dev-only convenience script — run with `npm run db:seed` against the
// local Docker Compose stack (`docker compose up -d` + `npm run db:migrate`
// first). Not used in production or CI.
//
// Creates one GoTrue account and a handful of pantry items via
// seed-support.ts's shared helpers — see that file for why signup goes
// through GoTrue's own endpoint rather than a hand-inserted auth.users row.
// The screenshot capture tool (screenshots/seed.ts) reuses the same
// helpers for its own per-scenario accounts.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import {
  DEFAULT_SEED_ITEMS,
  ensureHouseholdWithItems,
  findOrCreateAuthUser,
} from "@/db/seed-support";

const DEV_EMAIL = "dev@example.com";
const DEV_PASSWORD = "development";

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
    const { seeded } = await ensureHouseholdWithItems(
      db,
      userId,
      DEFAULT_SEED_ITEMS,
    );
    if (seeded) {
      console.log(`Seeded ${DEFAULT_SEED_ITEMS.length} pantry items.`);
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
