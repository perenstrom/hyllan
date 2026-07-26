import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { pantryItems } from "@/db/schema";
import type { PantryItemFormInput, PantryItemUnit } from "./pantry-item";
import {
  decrementQuantity,
  incrementQuantity,
  normalizePantryItemName,
} from "./pantry-item";

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

// Scopes a query to one item within one household, so an item id from
// another household (e.g. a tampered request) can never be read, adjusted,
// edited, or deleted.
function scopedToItem(householdId: string, itemId: string) {
  return and(
    eq(pantryItems.householdId, householdId),
    eq(pantryItems.id, itemId),
  );
}

export async function getPantryItem<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
) {
  const [item] = await db
    .select()
    .from(pantryItems)
    .where(scopedToItem(householdId, itemId));

  return item;
}

export type AddPantryItemInput = PantryItemFormInput;

// Thrown instead of merging when an add's name matches an existing item but
// its unit doesn't (ADR 0001) — units carry no conversion behavior, so
// summing across units would produce a meaningless total. Carries the
// existing item's name and unit so the caller can tell the user how to
// resubmit.
export class PantryItemUnitMismatchError extends Error {
  constructor(
    public readonly itemName: string,
    public readonly unit: PantryItemUnit,
  ) {
    super();
  }
}

function matchesNameInHousehold(householdId: string, normalizedName: string) {
  return and(
    eq(pantryItems.householdId, householdId),
    eq(sql`lower(${pantryItems.name})`, normalizedName),
  );
}

// Unit carries no conversion behavior (CONTEXT.md) — incrementing an
// existing item only happens when the add's unit matches the existing
// item's unit; a name match with a different unit rejects the add (ADR
// 0001) rather than summing across incompatible units.
async function incrementIfExists<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  normalizedName: string,
  unit: PantryItemUnit,
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
        matchesNameInHousehold(householdId, normalizedName),
        eq(pantryItems.unit, unit),
      ),
    )
    .returning();

  if (updated) {
    return updated;
  }

  const [existing] = await db
    .select()
    .from(pantryItems)
    .where(matchesNameInHousehold(householdId, normalizedName));

  if (existing) {
    throw new PantryItemUnitMismatchError(existing.name, existing.unit);
  }

  return undefined;
}

const UNIQUE_VIOLATION_CODE = "23505";

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

// Drizzle wraps the driver's error (which carries Postgres's error code) in
// a DrizzleQueryError, exposing the original as `.cause` — check both so
// this works whether the caller passed the wrapper or the raw error.
function isUniqueViolation(error: unknown): boolean {
  return (
    hasCode(error, UNIQUE_VIOLATION_CODE) ||
    (typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      hasCode(error.cause, UNIQUE_VIOLATION_CODE))
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
    input.unit,
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
    // the increment it should have been, applying the same unit-match check
    // (and mismatch rejection) as the straightforward path above. The row
    // that just won the unique-violation race should still be there, so a
    // "no match" result here would mean it was deleted in between — treat
    // that as failure of the original insert rather than silently no-op-ing.
    const retried = await incrementIfExists(
      db,
      householdId,
      normalizedName,
      input.unit,
      input.quantity,
    );
    if (!retried) {
      throw error;
    }
    return retried;
  }
}

// Reads the current row with a row lock (SELECT ... FOR UPDATE) and writes
// the adjusted quantity in the same transaction, so two concurrent
// increment/decrement clicks on the same item can't race — the second
// transaction blocks until the first commits, rather than both computing
// from the same stale quantity and one update getting lost.
async function adjustPantryItemQuantity<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
  adjust: (quantity: string) => string,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(pantryItems)
      .where(scopedToItem(householdId, itemId))
      .for("update");
    if (!current) {
      return undefined;
    }

    const [updated] = await tx
      .update(pantryItems)
      .set({ quantity: adjust(current.quantity), updatedAt: new Date() })
      .where(scopedToItem(householdId, itemId))
      .returning();

    return updated;
  });
}

// Increment/decrement icon buttons (ADR 0004, PER-226) adjust by exactly
// one step; decrementQuantity's zero floor is what guarantees a signed-in
// user can never drive a quantity negative from here.
export function incrementPantryItemQuantity<
  TQueryResult extends PgQueryResultHKT,
>(db: Database<TQueryResult>, householdId: string, itemId: string) {
  return adjustPantryItemQuantity(db, householdId, itemId, incrementQuantity);
}

export function decrementPantryItemQuantity<
  TQueryResult extends PgQueryResultHKT,
>(db: Database<TQueryResult>, householdId: string, itemId: string) {
  return adjustPantryItemQuantity(db, householdId, itemId, decrementQuantity);
}

export class DuplicatePantryItemNameError extends Error {}

export type UpdatePantryItemInput = PantryItemFormInput;

// Unlike addPantryItem, editing to a name that collides with another item
// in the same household is a user mistake to report, not a case to fold
// into — the caller decides what to tell them.
export async function updatePantryItem<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
  input: UpdatePantryItemInput,
) {
  try {
    const [updated] = await db
      .update(pantryItems)
      .set({
        name: input.name.trim(),
        quantity: input.quantity,
        unit: input.unit,
        updatedAt: new Date(),
      })
      .where(scopedToItem(householdId, itemId))
      .returning();

    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicatePantryItemNameError();
    }
    throw error;
  }
}

export async function deletePantryItem<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
) {
  const [deleted] = await db
    .delete(pantryItems)
    .where(scopedToItem(householdId, itemId))
    .returning();

  return deleted;
}
