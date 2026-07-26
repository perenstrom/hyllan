import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { authUsers } from "@/db/schema";

// Generic over the query-result HKT (rather than tied to the app's
// postgres-js client) so the same function runs against both the real
// Postgres connection and a PGlite-backed db in integration tests.
type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> =
  PgDatabase<TQueryResult, typeof schema>;

// Deletes the GoTrue user row directly, rather than going through GoTrue's
// admin API — households.userId and pantry_items.householdId both cascade
// (ADR 0002), so this single delete immediately removes the household and
// every pantry item in it. Safe because the app's own Postgres role already
// has full access to the auth schema (see .env.example's POSTGRES_USER
// note); this is the one deliberate exception to auth.ts's "never written
// to by app code" — account deletion needs the row gone, not edited.
export async function deleteUserAccount<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  userId: string,
) {
  await db.delete(authUsers).where(eq(authUsers.id, userId));
}
