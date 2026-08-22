import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { itemLocations, locations, pantryItems } from "@/db/schema";
import { isUniqueViolation } from "./db-errors";
import {
  locationIdCondition,
  setBucketQuantity,
  upsertBucketQuantity,
} from "./item-locations";
import { bucketsTotal, type PantryItemBucket } from "./location";
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

export type PantryItemWithLocations = typeof pantryItems.$inferSelect & {
  // Sum of `buckets` — kept as a top-level field (rather than requiring
  // every caller to re-derive it) so the existing sort/filter/status
  // helpers in pantry-item.ts, which only care about an item's total, keep
  // working unchanged against this composite shape.
  quantity: string;
  buckets: PantryItemBucket[];
};

// One query for however many items need their buckets, rather than one
// query per item — used by both listPantryItems (many items) and
// getPantryItem/addPantryItem/updatePantryItem (one item, for a uniform
// code path).
async function fetchBucketsByItem<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  itemIds: string[],
): Promise<Map<string, PantryItemBucket[]>> {
  const bucketsByItem = new Map<string, PantryItemBucket[]>();
  if (itemIds.length === 0) {
    return bucketsByItem;
  }

  const rows = await db
    .select({
      pantryItemId: itemLocations.pantryItemId,
      locationId: itemLocations.locationId,
      locationName: locations.name,
      quantity: itemLocations.quantity,
    })
    .from(itemLocations)
    .leftJoin(locations, eq(itemLocations.locationId, locations.id))
    .where(inArray(itemLocations.pantryItemId, itemIds));

  for (const row of rows) {
    const bucket: PantryItemBucket = {
      locationId: row.locationId,
      locationName: row.locationName,
      quantity: row.quantity,
    };
    const existing = bucketsByItem.get(row.pantryItemId);
    if (existing) {
      existing.push(bucket);
    } else {
      bucketsByItem.set(row.pantryItemId, [bucket]);
    }
  }

  return bucketsByItem;
}

function withLocations(
  item: typeof pantryItems.$inferSelect,
  buckets: PantryItemBucket[],
): PantryItemWithLocations {
  return { ...item, quantity: bucketsTotal(buckets), buckets };
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

  const bucketsByItem = await fetchBucketsByItem(
    db,
    items.map((item) => item.id),
  );

  return items.map((item) =>
    withLocations(item, bucketsByItem.get(item.id) ?? []),
  );
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

  const bucketsByItem = await fetchBucketsByItem(db, [itemId]);
  return withLocations(item, bucketsByItem.get(itemId) ?? []);
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

    await upsertBucketQuantity(tx, existing.id, locationId, quantity);
    const [touched] = await tx
      .update(pantryItems)
      .set({ updatedAt: new Date() })
      .where(eq(pantryItems.id, existing.id))
      .returning();

    const bucketsByItem = await fetchBucketsByItem(tx, [touched.id]);
    return withLocations(touched, bucketsByItem.get(touched.id) ?? []);
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
    const [inserted] = await db
      .insert(pantryItems)
      .values({
        householdId,
        name: input.name.trim(),
        unit: input.unit,
        minimumQuantity: input.minimumQuantity ?? null,
      })
      .returning();

    await db.insert(itemLocations).values({
      pantryItemId: inserted.id,
      locationId,
      quantity: input.quantity,
    });

    const bucketsByItem = await fetchBucketsByItem(db, [inserted.id]);
    return withLocations(inserted, bucketsByItem.get(inserted.id) ?? []);
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

// Reads the current bucket row with a row lock (SELECT ... FOR UPDATE) and
// writes the adjusted quantity in the same transaction, so two concurrent
// increment/decrement clicks on the same (item, location) bucket can't
// race. Returns undefined when the item isn't in this household, or the
// bucket doesn't exist (the item-list UI only ever targets a bucket it's
// currently showing, so a missing bucket means stale client state).
async function adjustBucketQuantity<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
  locationId: string | null,
  adjust: (quantity: string) => string,
) {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(pantryItems)
      .where(scopedToItem(householdId, itemId));
    if (!item) {
      return undefined;
    }

    const [current] = await tx
      .select()
      .from(itemLocations)
      .where(
        and(
          eq(itemLocations.pantryItemId, itemId),
          locationIdCondition(locationId),
        ),
      )
      .for("update");
    if (!current) {
      return undefined;
    }

    const [updated] = await tx
      .update(itemLocations)
      .set({ quantity: adjust(current.quantity), updatedAt: new Date() })
      .where(eq(itemLocations.id, current.id))
      .returning();

    return updated;
  });
}

// Increment/decrement icon buttons (ADR 0004, PER-226) adjust one bucket by
// exactly one step; decrementQuantity's zero floor is what guarantees a
// signed-in user can never drive a bucket's quantity negative from here.
export function incrementPantryItemQuantity<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
  locationId: string | null,
) {
  return adjustBucketQuantity(
    db,
    householdId,
    itemId,
    locationId,
    incrementQuantity,
  );
}

export function decrementPantryItemQuantity<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
  locationId: string | null,
) {
  return adjustBucketQuantity(
    db,
    householdId,
    itemId,
    locationId,
    decrementQuantity,
  );
}

// Stock take's correction (CONTEXT.md "Stock take", ADR 0006): sets one
// (item, location) bucket's quantity directly to an absolute observed
// value, creating the bucket row if it doesn't exist yet (shelf-to-stock
// adding an item not yet recorded at this Location), without touching any
// of the item's other buckets. Returns undefined when the item isn't in
// this household — same "stale client state" contract as
// adjustBucketQuantity above.
export async function setPantryItemLocationQuantity<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
  locationId: string,
  quantity: string,
): Promise<PantryItemWithLocations | undefined> {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(pantryItems)
      .where(scopedToItem(householdId, itemId));
    if (!item) {
      return undefined;
    }

    await setBucketQuantity(tx, itemId, locationId, quantity);

    const bucketsByItem = await fetchBucketsByItem(tx, [itemId]);
    return withLocations(item, bucketsByItem.get(itemId) ?? []);
  });
}

export class DuplicatePantryItemNameError extends Error {}

export type UpdatePantryItemInput = PantryItemFormInput;

// Unlike addPantryItem, editing to a name that collides with another item
// in the same household is a user mistake to report, not a case to fold
// into — the caller decides what to tell them.
//
// The quantity/location pair is an absolute set on the one bucket this
// edit targets (creating it if it doesn't exist yet) — editing an item
// never touches any of its OTHER buckets, so this can't silently zero out
// quantity held elsewhere. When the submitted locationId differs from
// input.originalLocationId (the bucket the form was opened against — see
// PantryItemFormInput), that target bucket moves: its old row is removed
// and the new location's row is set to input.quantity, rather than
// leaving a stale duplicate behind at the old location while a second
// bucket appears at the new one.
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

    const locationId = input.locationId ?? null;
    const originalLocationId = input.originalLocationId ?? null;

    if (locationId !== originalLocationId) {
      await tx
        .delete(itemLocations)
        .where(
          and(
            eq(itemLocations.pantryItemId, itemId),
            locationIdCondition(originalLocationId),
          ),
        );
    }

    const [existingBucket] = await tx
      .select()
      .from(itemLocations)
      .where(
        and(
          eq(itemLocations.pantryItemId, itemId),
          locationIdCondition(locationId),
        ),
      )
      .for("update");

    if (existingBucket) {
      await tx
        .update(itemLocations)
        .set({ quantity: input.quantity, updatedAt: new Date() })
        .where(eq(itemLocations.id, existingBucket.id));
    } else {
      await tx
        .insert(itemLocations)
        .values({ pantryItemId: itemId, locationId, quantity: input.quantity });
    }

    const bucketsByItem = await fetchBucketsByItem(tx, [itemId]);
    return withLocations(updatedItem, bucketsByItem.get(itemId) ?? []);
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
