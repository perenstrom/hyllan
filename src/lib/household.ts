import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { households } from "@/db/schema";

// Generic over the query-result HKT (rather than tied to the app's
// postgres-js client) so the same function runs against both the real
// Postgres connection and a PGlite-backed db in integration tests.
type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> =
  PgDatabase<TQueryResult, typeof schema>;

// Idempotent: signup calls this once per new user, but a retried Server
// Action (e.g. the redirect step failing after insert) must not create a
// second household for the same user — households_user_id_unique (ADR 0002)
// is what makes the conflict-and-fetch-existing fallback below safe.
export async function createHouseholdForUser<
  TQueryResult extends PgQueryResultHKT,
>(db: Database<TQueryResult>, userId: string) {
  const [inserted] = await db
    .insert(households)
    .values({ userId })
    .onConflictDoNothing({ target: households.userId })
    .returning();

  if (inserted) {
    return inserted;
  }

  const [existing] = await db
    .select()
    .from(households)
    .where(eq(households.userId, userId));

  return existing;
}

// Every signed-in user has exactly one household, auto-created at signup
// (ADR 0002) — callers can trust the result rather than handling a "no
// household yet" case.
export async function getHouseholdForUser<
  TQueryResult extends PgQueryResultHKT,
>(db: Database<TQueryResult>, userId: string) {
  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.userId, userId));

  return household;
}
