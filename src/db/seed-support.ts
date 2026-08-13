// Shared by src/db/seed.ts (npm run db:seed) and the screenshot capture tool
// (screenshots/seed.ts) — both need "find or create a GoTrue account, then
// ensure its household has a given set of pantry items," just with
// different accounts/items. Kept here so neither has to duplicate GoTrue's
// signup call or the household/item bootstrap logic.
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type postgres from "postgres";

import * as schema from "@/db/schema";
import { createHouseholdForUser } from "@/lib/household";
import { addPantryItem, listPantryItems } from "@/lib/pantry-items";
import type { AddPantryItemInput } from "@/lib/pantry-items";

// Generic over the query-result HKT, same rationale as household.ts/
// pantry-items.ts: this runs against both the real Postgres connection and
// (via the screenshot tool's own seeding) the same shape of client.
type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> =
  PgDatabase<TQueryResult, typeof schema>;

export const DEFAULT_SEED_ITEMS: AddPantryItemInput[] = [
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

// Creates the account through the same `/signup` endpoint the app itself
// calls (README's next.config.ts rewrite note — standalone GoTrue has no
// Kong, so /auth/v1/* rewrites to GOTRUE_API_EXTERNAL_URL, meaning
// GOTRUE_API_EXTERNAL_URL/signup is the unprefixed endpoint) if it doesn't
// already exist, so seeded accounts go through the exact same code path as
// a real signup rather than a hand-inserted auth.users row.
export async function findOrCreateAuthUser(
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

// Idempotent per household, same as db:seed's original behavior: only seeds
// items when the household doesn't already have any, so re-running against
// an already-seeded account is a safe no-op rather than piling up
// duplicates. Returns the resulting items either way, so a caller that
// needs their ids (e.g. the screenshot tool's edit-item scenario) doesn't
// have to issue its own follow-up query.
export async function ensureHouseholdWithItems<
  TQueryResult extends PgQueryResultHKT,
>(db: Database<TQueryResult>, userId: string, items: AddPantryItemInput[]) {
  const household = await createHouseholdForUser(db, userId);

  const existing = await listPantryItems(db, household.id);
  if (existing.length > 0) {
    return { household, items: existing, seeded: false as const };
  }

  for (const item of items) {
    await addPantryItem(db, household.id, item);
  }
  const seededItems = await listPantryItems(db, household.id);

  return { household, items: seededItems, seeded: true as const };
}
