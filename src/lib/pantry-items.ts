import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { pantryItems } from "@/db/schema";
import { isUniqueViolation } from "./db-errors";
import type { PantryItemBucket } from "./location";
import type { PantryItemFormInput, PantryItemUnit } from "./pantry-item";
import { normalizePantryItemName } from "./pantry-item";
import {
  adjustBucket,
  fetchItemQuantities,
  type BucketAdjustment,
  type ItemQuantity,
  relocateBucket,
  setBucket,
} from "./quantity";

// Generic over the query-result HKT (rather than tied to the app's
// postgres-js client) so the same functions run against both the real
// Postgres connection and a PGlite-backed db in integration tests.
type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> =
  PgDatabase<TQueryResult, typeof schema>;

export type PantryItemWithLocations = typeof pantryItems.$inferSelect & {
  // Sum of `buckets` — kept as a top-level field (rather than requiring
  // every caller to re-derive it) so the existing sort/filter/status
  // helpers in pantry-item.ts, which only care about an item's total, keep
  // working unchanged against this composite shape.
  quantity: string;
  buckets: PantryItemBucket[];
};

// Composes an item row with its Buckets as read or written by the Quantity
// module — an item with no rows at all (shouldn't happen; see setBucket)
// reads as zero.
function withLocations(
  item: typeof pantryItems.$inferSelect,
  { buckets, total }: ItemQuantity = { buckets: [], total: "0" },
): PantryItemWithLocations {
  return { ...item, quantity: total, buckets };
}

export async function listPantryItems<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
): Promise<PantryItemWithLocations[]> {
  const items = await db
    .select()
    .from(pantryItems)
    .where(eq(pantryItems.householdId, householdId))
    .orderBy(pantryItems.createdAt);

  const quantities = await fetchItemQuantities(
    db,
    items.map((item) => item.id),
  );

  return items.map((item) => withLocations(item, quantities.get(item.id)));
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
): Promise<PantryItemWithLocations | undefined> {
  const [item] = await db
    .select()
    .from(pantryItems)
    .where(scopedToItem(householdId, itemId));

  if (!item) {
    return undefined;
  }

  const quantities = await fetchItemQuantities(db, [itemId]);
  return withLocations(item, quantities.get(itemId));
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

// Unit carries no conversion behavior (CONTEXT.md) — merging into an
// existing item only happens when the add's unit matches the existing
// item's unit; a name match with a different unit rejects the add (ADR
// 0001) rather than summing across incompatible units.
async function mergeIntoExistingItem<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  normalizedName: string,
  unit: PantryItemUnit,
  quantity: string,
  locationId: string | null,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(pantryItems)
      .where(matchesNameInHousehold(householdId, normalizedName))
      .for("update");

    if (!existing) {
      return undefined;
    }
    if (existing.unit !== unit) {
      throw new PantryItemUnitMismatchError(existing.name, existing.unit);
    }

    const adjusted = await adjustBucket(
      tx,
      householdId,
      existing.id,
      locationId,
      quantity,
    );
    const [touched] = await tx
      .update(pantryItems)
      .set({ updatedAt: new Date() })
      .where(eq(pantryItems.id, existing.id))
      .returning();

    return withLocations(touched, adjusted);
  });
}

// Adding under a name that already exists in the household increments that
// item's quantity at the given location instead of inserting a second row
// (ADR 0001), matched case-insensitively via normalizePantryItemName
// against the DB's pantry_items_household_id_name_unique constraint.
export async function addPantryItem<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  input: AddPantryItemInput,
): Promise<PantryItemWithLocations> {
  const normalizedName = normalizePantryItemName(input.name);
  const locationId = input.locationId ?? null;

  const merged = await mergeIntoExistingItem(
    db,
    householdId,
    normalizedName,
    input.unit,
    input.quantity,
    locationId,
  );
  if (merged) {
    return merged;
  }

  try {
    return await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(pantryItems)
        .values({
          householdId,
          name: input.name.trim(),
          unit: input.unit,
          minimumQuantity: input.minimumQuantity ?? null,
        })
        .returning();

      // setBucket, not adjustBucket: a new item added with quantity 0 still
      // needs its first row.
      const itemQuantity = await setBucket(
        tx,
        householdId,
        inserted.id,
        locationId,
        input.quantity,
      );
      return withLocations(inserted, itemQuantity);
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    // Two concurrent adds under a brand-new name can both miss the merge
    // above and race for the insert — the loser hits
    // pantry_items_household_id_name_unique instead of crashing. Retry as
    // the merge it should have been, applying the same unit-match check
    // (and mismatch rejection) as the straightforward path above. The row
    // that just won the unique-violation race should still be there, so a
    // "no match" result here would mean it was deleted in between — treat
    // that as failure of the original insert rather than silently no-op-ing.
    const retried = await mergeIntoExistingItem(
      db,
      householdId,
      normalizedName,
      input.unit,
      input.quantity,
      locationId,
    );
    if (!retried) {
      throw error;
    }
    return retried;
  }
}

export type PantryItemAdjustment = {
  item: PantryItemWithLocations;
  appliedDelta: BucketAdjustment["appliedDelta"];
};

// adjustBucket composed with the item row, for callers that report the
// item back (batch entry, PER-307/PER-308). Returns undefined when the
// item isn't in this household.
export async function adjustPantryItemQuantity<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
  locationId: string | null,
  delta: string,
): Promise<PantryItemAdjustment | undefined> {
  return db.transaction(async (tx) => {
    const adjusted = await adjustBucket(
      tx,
      householdId,
      itemId,
      locationId,
      delta,
    );
    if (!adjusted) {
      return undefined;
    }

    const [item] = await tx
      .select()
      .from(pantryItems)
      .where(scopedToItem(householdId, itemId));
    return {
      item: withLocations(item, adjusted),
      appliedDelta: adjusted.appliedDelta,
    };
  });
}

export class DuplicatePantryItemNameError extends Error {}

export type UpdatePantryItemInput = PantryItemFormInput;

// Unlike addPantryItem, editing to a name that collides with another item
// in the same household is a user mistake to report, not a case to fold
// into — the caller decides what to tell them.
//
// The quantity/location pair targets the one bucket the form was opened
// against (input.originalLocationId — see PantryItemFormInput); editing an
// item never touches any of its OTHER buckets. With the location unchanged
// it's an absolute set; with a new location the bucket moves there and its
// quantity is added to whatever that Location already holds (relocateBucket)
// rather than overwriting it.
export async function updatePantryItem<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
  input: UpdatePantryItemInput,
): Promise<PantryItemWithLocations | undefined> {
  return db.transaction(async (tx) => {
    let updatedItem;
    try {
      [updatedItem] = await tx
        .update(pantryItems)
        .set({
          name: input.name.trim(),
          unit: input.unit,
          minimumQuantity: input.minimumQuantity ?? null,
          updatedAt: new Date(),
        })
        .where(scopedToItem(householdId, itemId))
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicatePantryItemNameError();
      }
      throw error;
    }

    if (!updatedItem) {
      return undefined;
    }

    const itemQuantity = await relocateBucket(
      tx,
      householdId,
      itemId,
      input.originalLocationId ?? null,
      input.locationId ?? null,
      input.quantity,
    );
    return withLocations(updatedItem, itemQuantity);
  });
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
