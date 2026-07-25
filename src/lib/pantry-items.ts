import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { pantryItems } from "@/db/schema";
import type { PantryItemFormInput } from "./pantry-item";
import { normalizePantryItemName } from "./pantry-item";

// Generic over the query-result HKT (rather than tied to the app's
// postgres-js client) so the same functions run against both the real
// Postgres connection and a PGlite-backed db in integration tests.
type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> =
  PgDatabase<TQueryResult, typeof schema>;

export async function listPantryItems<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
) {
  return db
    .select()
    .from(pantryItems)
    .where(eq(pantryItems.householdId, householdId))
    .orderBy(pantryItems.createdAt);
}

export type AddPantryItemInput = PantryItemFormInput;

// Unit carries no conversion behavior (CONTEXT.md) — incrementing an
// existing item only ever adds the raw quantity and leaves its original
// unit in place, ignoring whatever unit this particular add specified.
async function incrementIfExists<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  normalizedName: string,
  quantity: string,
) {
  const [updated] = await db
    .update(pantryItems)
    .set({
      quantity: sql`${pantryItems.quantity} + ${quantity}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pantryItems.householdId, householdId),
        eq(sql`lower(${pantryItems.name})`, normalizedName),
      ),
    )
    .returning();

  return updated;
}

const UNIQUE_VIOLATION_CODE = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === UNIQUE_VIOLATION_CODE
  );
}

// Adding under a name that already exists in the household increments that
// item's quantity instead of inserting a second row (ADR 0001), matched
// case-insensitively via normalizePantryItemName against the DB's
// pantry_items_household_id_name_unique constraint.
export async function addPantryItem<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  input: AddPantryItemInput,
) {
  const normalizedName = normalizePantryItemName(input.name);

  const updated = await incrementIfExists(
    db,
    householdId,
    normalizedName,
    input.quantity,
  );
  if (updated) {
    return updated;
  }

  try {
    const [inserted] = await db
      .insert(pantryItems)
      .values({
        householdId,
        name: input.name.trim(),
        quantity: input.quantity,
        unit: input.unit,
      })
      .returning();

    return inserted;
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    // Two concurrent adds under a brand-new name can both miss the update
    // above and race for the insert — the loser hits
    // pantry_items_household_id_name_unique instead of crashing. Retry as
    // the increment it should have been.
    return incrementIfExists(db, householdId, normalizedName, input.quantity);
  }
}
