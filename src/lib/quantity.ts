import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { itemLocations, locations, pantryItems } from "@/db/schema";
import { bucketsTotal, type PantryItemBucket } from "./location";

// The Quantity module: the one place that writes a pantry item's Buckets
// (CONTEXT.md "Bucket") — its amount at one Location, or at the implicit
// unassigned bucket (ADR 0005). Pantry item identity (name merge, unit
// mismatch, duplicate names — ADR 0001) stays in pantry-items.ts, which
// calls into here, never the other way round.
//
// Every write:
// - names exactly one (item, locationId | null) bucket — there's no
//   "drain the item's total across Locations" policy;
// - is household-scoped, returning undefined for an item outside the
//   household;
// - takes db or a transaction and wraps itself in db.transaction(...), so it
//   becomes a savepoint inside a caller's own transaction;
// - does its arithmetic in Postgres numeric, never JS Number, so decimal
//   amounts don't drift (0.1 + 0.2 lands on exactly 0.3).

// Generic over the query-result HKT, same rationale as pantry-items.ts —
// runs against both the real Postgres connection and PGlite in tests.
type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> =
  PgDatabase<TQueryResult, typeof schema>;

export type ItemQuantity = {
  buckets: PantryItemBucket[];
  // Sum of `buckets` (CONTEXT.md "Quantity").
  total: string;
};

export type BucketAdjustment = ItemQuantity & {
  // The signed delta actually written — differs from the requested delta
  // when a removal hit the zero floor, so an undo can invert exactly what
  // happened rather than what was asked for.
  appliedDelta: string;
};

// One query for however many items need their buckets, rather than one
// query per item. Every requested id gets an entry, even one with no rows.
export async function fetchItemQuantities<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  itemIds: string[],
): Promise<Map<string, ItemQuantity>> {
  const bucketsByItem = new Map<string, PantryItemBucket[]>(
    itemIds.map((id) => [id, []]),
  );
  if (itemIds.length > 0) {
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

    for (const { pantryItemId, ...bucket } of rows) {
      bucketsByItem.get(pantryItemId)?.push(bucket);
    }
  }

  return new Map(
    [...bucketsByItem].map(([id, buckets]) => [
      id,
      { buckets, total: bucketsTotal(buckets) },
    ]),
  );
}

async function fetchItemQuantity<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  itemId: string,
): Promise<ItemQuantity> {
  const quantities = await fetchItemQuantities(db, [itemId]);
  return quantities.get(itemId) ?? { buckets: [], total: "0" };
}

function bucketCondition(itemId: string, locationId: string | null) {
  return and(
    eq(itemLocations.pantryItemId, itemId),
    locationId === null
      ? isNull(itemLocations.locationId)
      : eq(itemLocations.locationId, locationId),
  );
}

// Row-locks the pantry item (when it's in this household) for the rest of
// the transaction. Locking the item rather than the bucket row is what
// makes insert-if-missing race-safe: a SELECT ... FOR UPDATE on a bucket
// that doesn't exist yet locks nothing, so two writers could both miss it
// and both insert. NO KEY UPDATE serializes bucket writers without blocking
// unrelated inserts that merely reference the item (barcode registrations).
async function lockItem<TQueryResult extends PgQueryResultHKT>(
  tx: Database<TQueryResult>,
  householdId: string,
  itemId: string,
) {
  const [item] = await tx
    .select({ id: pantryItems.id })
    .from(pantryItems)
    .where(
      and(eq(pantryItems.householdId, householdId), eq(pantryItems.id, itemId)),
    )
    .for("no key update");
  return item;
}

// Adds `delta` to one bucket, floored at zero, and returns the delta
// actually applied. A missing bucket is created only when `insertIfMissing`
// — callers decide whether a zero or negative amount still earns a row.
// Caller must already hold lockItem.
async function addToBucket<TQueryResult extends PgQueryResultHKT>(
  tx: Database<TQueryResult>,
  itemId: string,
  locationId: string | null,
  delta: string,
  insertIfMissing: boolean,
): Promise<string> {
  const [current] = await tx
    .select()
    .from(itemLocations)
    .where(bucketCondition(itemId, locationId));

  if (current) {
    const [updated] = await tx
      .update(itemLocations)
      .set({
        quantity: sql`greatest(${itemLocations.quantity} + ${delta}::numeric, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(itemLocations.id, current.id))
      .returning({
        appliedDelta: sql<string>`(${itemLocations.quantity} - ${current.quantity}::numeric)::text`,
      });
    return updated.appliedDelta;
  }

  if (!insertIfMissing) {
    return "0";
  }
  const [inserted] = await tx
    .insert(itemLocations)
    .values({
      pantryItemId: itemId,
      locationId,
      quantity: sql`greatest(${delta}::numeric, 0)`,
    })
    .returning({ quantity: itemLocations.quantity });
  return inserted.quantity;
}

// Sets one bucket to an absolute amount, creating it if missing. Caller
// must already hold lockItem.
async function writeLockedBucket<TQueryResult extends PgQueryResultHKT>(
  tx: Database<TQueryResult>,
  itemId: string,
  locationId: string | null,
  quantity: string,
) {
  const [updated] = await tx
    .update(itemLocations)
    .set({ quantity, updatedAt: new Date() })
    .where(bucketCondition(itemId, locationId))
    .returning({ id: itemLocations.id });
  if (!updated) {
    await tx
      .insert(itemLocations)
      .values({ pantryItemId: itemId, locationId, quantity });
  }
}

// Moves one bucket by a signed delta — ± buttons (ADR 0004), batch entry
// (PER-307), and addPantryItem's merge path. A removal floors at zero
// instead of rejecting; a missing bucket is created only for a positive
// delta (an item whose stock all sits at Locations has no unassigned row
// until something is added there).
export async function adjustBucket<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
  locationId: string | null,
  delta: string,
): Promise<BucketAdjustment | undefined> {
  return db.transaction(async (tx) => {
    if (!(await lockItem(tx, householdId, itemId))) {
      return undefined;
    }

    const appliedDelta = await addToBucket(
      tx,
      itemId,
      locationId,
      delta,
      Number(delta) > 0,
    );
    return { ...(await fetchItemQuantity(tx, itemId)), appliedDelta };
  });
}

// Sets one bucket to an absolute amount, always creating it if missing —
// Stock take's correction (CONTEXT.md "Stock take", ADR 0006), and a newly
// created pantry item's first bucket (so even a zero-quantity item keeps
// the "every item has at least one item_locations row" invariant).
export async function setBucket<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
  locationId: string | null,
  quantity: string,
): Promise<ItemQuantity | undefined> {
  return db.transaction(async (tx) => {
    if (!(await lockItem(tx, householdId, itemId))) {
      return undefined;
    }

    await writeLockedBucket(tx, itemId, locationId, quantity);
    return fetchItemQuantity(tx, itemId);
  });
}

// Editing a bucket onto another Location (updatePantryItem): removes the
// source row and ADDS `quantity` to the target bucket — never overwriting
// what the target Location already holds (CONTEXT.md "Location"). The
// target row is created even at zero, since the source row it replaces may
// have been the item's only one. Same source and target is a plain set.
// Only edit uses this — Stock take has no move primitive (ADR 0006).
export async function relocateBucket<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  itemId: string,
  fromLocationId: string | null,
  toLocationId: string | null,
  quantity: string,
): Promise<ItemQuantity | undefined> {
  return db.transaction(async (tx) => {
    if (!(await lockItem(tx, householdId, itemId))) {
      return undefined;
    }

    if (fromLocationId === toLocationId) {
      await writeLockedBucket(tx, itemId, toLocationId, quantity);
    } else {
      await tx
        .delete(itemLocations)
        .where(bucketCondition(itemId, fromLocationId));
      await addToBucket(tx, itemId, toLocationId, quantity, true);
    }
    return fetchItemQuantity(tx, itemId);
  });
}

// Folds every bucket at a Location into its item's unassigned bucket and
// removes those rows (ADR 0005) — deleteLocation's first step, so deleting
// a Location never discards quantity. Zero rows fold too, keeping the
// "every item has at least one item_locations row" invariant when this was
// an item's only bucket. Returns false for a Location outside the
// household. Leaves the Location row itself to the caller.
export async function foldLocationBuckets<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  householdId: string,
  locationId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [location] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.householdId, householdId),
          eq(locations.id, locationId),
        ),
      );
    if (!location) {
      return false;
    }

    // Same item lock as the single-bucket writers, taken in id order so two
    // folds sharing items can't deadlock.
    const lockedItems = await tx
      .select({ id: pantryItems.id })
      .from(pantryItems)
      .where(
        and(
          eq(pantryItems.householdId, householdId),
          inArray(
            pantryItems.id,
            tx
              .select({ id: itemLocations.pantryItemId })
              .from(itemLocations)
              .where(eq(itemLocations.locationId, locationId)),
          ),
        ),
      )
      .orderBy(pantryItems.id)
      .for("no key update");

    for (const { id } of lockedItems) {
      const [row] = await tx
        .select()
        .from(itemLocations)
        .where(bucketCondition(id, locationId));
      if (row) {
        await addToBucket(tx, id, null, row.quantity, true);
      }
    }

    await tx
      .delete(itemLocations)
      .where(eq(itemLocations.locationId, locationId));
    return true;
  });
}
