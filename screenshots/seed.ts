// Per-scenario data seeding for the screenshot capture tool (PER-262).
// Reuses src/db/seed-support.ts (the same helpers `npm run db:seed` uses)
// rather than re-implementing account/household bootstrap — see that
// file's comment for why account creation goes through GoTrue's own
// /signup endpoint.
import { drizzle } from "drizzle-orm/postgres-js";
import type postgres from "postgres";

import * as schema from "@/db/schema";
import { ensureHouseholdWithItems, findOrCreateAuthUser } from "@/db/seed-support";
import type { AddPantryItemInput } from "@/lib/pantry-items";

// Never used to actually log in (the capture tool authenticates by minting
// a session JWT directly — see src/lib/testing/mock-session.ts), but
// GoTrue's /signup endpoint requires some password.
const SCREENSHOT_ACCOUNT_PASSWORD = "screenshot-tool-password";

export type SeededContext = {
  userId: string;
  email: string;
  householdId: string;
  itemIds: string[];
};

// Each scenario gets its own dedicated account (screenshot-<name>@example.com)
// instead of sharing one, so scenarios can't bleed pantry state into each
// other, and re-running the capture tool against an already-seeded database
// is a safe no-op — same idempotency guarantee ensureHouseholdWithItems
// already gives db:seed.
export async function seedScenario(
  sql: postgres.Sql,
  scenarioName: string,
  items: AddPantryItemInput[],
): Promise<SeededContext> {
  const db = drizzle(sql, { schema });
  const email = `screenshot-${scenarioName}@example.com`;

  const userId = await findOrCreateAuthUser(
    sql,
    email,
    SCREENSHOT_ACCOUNT_PASSWORD,
  );
  const { household, items: seededItems } = await ensureHouseholdWithItems(
    db,
    userId,
    items,
  );

  return {
    userId,
    email,
    householdId: household.id,
    itemIds: seededItems.map((item) => item.id),
  };
}
