import { and, eq, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { itemLocations } from "@/db/schema";

// Generic over the query-result HKT, same rationale as pantry-items.ts —
// runs against both the real Postgres connection and PGlite in tests.
type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> =
  PgDatabase<TQueryResult, typeof schema>;

export function locationIdCondition(locationId: string | null) {
  return locationId === null
    ? isNull(itemLocations.locationId)
    : eq(itemLocations.locationId, locationId);
}

// Row-locks the (item, location) bucket for the rest of the caller's
// transaction, so an upsert-shaped write (add-or-update) can't race with a
// concurrent one targeting the same not-yet-existing bucket. Shared by
// upsertBucketQuantity and setBucketQuantity below.
async function lockBucket<TQueryResult extends PgQueryResultHKT>(
  tx: Database<TQueryResult>,
  pantryItemId: string,
  locationId: string | null,
) {
  const [existing] = await tx
    .select()
    .from(itemLocations)
    .where(
      and(
        eq(itemLocations.pantryItemId, pantryItemId),
        locationIdCondition(locationId),
      ),
    )
    .for("update");
  return existing;
}

// Adds `delta` to the (item, location) bucket's quantity, creating the
// bucket row if it doesn't exist yet. Must run inside the caller's
// transaction — select-for-update then update-or-insert, so two concurrent
// writers targeting the same not-yet-existing bucket can't both miss the
// row and double-insert. Shared by pantry-items.ts's addPantryItem merge
// path and locations.ts's deleteLocation merge-into-unassigned.
export async function upsertBucketQuantity<
  TQueryResult extends PgQueryResultHKT,
>(
  tx: Database<TQueryResult>,
  pantryItemId: string,
  locationId: string | null,
  delta: string,
) {
  const existing = await lockBucket(tx, pantryItemId, locationId);

  if (existing) {
    const [updated] = await tx
      .update(itemLocations)
      .set({
        quantity: sql`${itemLocations.quantity} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(itemLocations.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await tx
    .insert(itemLocations)
    .values({ pantryItemId, locationId, quantity: delta })
    .returning();
  return inserted;
}

// Sets the (item, location) bucket's quantity to an absolute value, creating
// the bucket row if it doesn't exist yet — Stock take's correction
// (CONTEXT.md "Stock take", ADR 0006), as opposed to upsertBucketQuantity's
// delta. Same race-safety requirement: must run inside the caller's
// transaction.
export async function setBucketQuantity<TQueryResult extends PgQueryResultHKT>(
  tx: Database<TQueryResult>,
  pantryItemId: string,
  locationId: string | null,
  quantity: string,
) {
  const existing = await lockBucket(tx, pantryItemId, locationId);

  if (existing) {
    const [updated] = await tx
      .update(itemLocations)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(itemLocations.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await tx
    .insert(itemLocations)
    .values({ pantryItemId, locationId, quantity })
    .returning();
  return inserted;
}
