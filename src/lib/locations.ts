import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { itemLocations, locations } from "@/db/schema";
import { isUniqueViolation } from "./db-errors";
import { upsertBucketQuantity } from "./item-locations";

// Generic over the query-result HKT, same rationale as pantry-items.ts —
// runs against both the real Postgres connection and PGlite in tests.
type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> =
  PgDatabase<TQueryResult, typeof schema>;

export class DuplicateLocationNameError extends Error {}

export async function listLocations<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
) {
  return db
    .select()
    .from(locations)
    .where(eq(locations.householdId, householdId))
    .orderBy(locations.createdAt);
}

// Scopes a query to one location within one household, so a location id
// from another household can never be read, renamed, or deleted — same
// rationale as pantry-items.ts's scopedToItem.
function scopedToLocation(householdId: string, locationId: string) {
  return and(
    eq(locations.householdId, householdId),
    eq(locations.id, locationId),
  );
}

export async function addLocation<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  name: string,
) {
  try {
    const [inserted] = await db
      .insert(locations)
      .values({ householdId, name: name.trim() })
      .returning();
    return inserted;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateLocationNameError();
    }
    throw error;
  }
}

export async function renameLocation<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  locationId: string,
  name: string,
) {
  try {
    const [updated] = await db
      .update(locations)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(scopedToLocation(householdId, locationId))
      .returning();
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateLocationNameError();
    }
    throw error;
  }
}

// Deletes a location, merging every item_locations row it held back into
// each item's unassigned bucket first (ADR 0005) — never discarding
// quantity, via the same select-for-update-then-update-or-insert upsert
// pantry-items.ts's add path uses (upsertBucketQuantity), not the FK's ON
// DELETE behavior: a plain SET NULL cascade could collide with an item
// that already has an unassigned row (the whole reason
// itemLocations.locationId carries no onDelete action — see
// src/db/schema/app.ts).
export async function deleteLocation<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  locationId: string,
) {
  return db.transaction(async (tx) => {
    const [location] = await tx
      .select()
      .from(locations)
      .where(scopedToLocation(householdId, locationId));
    if (!location) {
      return undefined;
    }

    const rowsAtLocation = await tx
      .select()
      .from(itemLocations)
      .where(eq(itemLocations.locationId, locationId));

    for (const row of rowsAtLocation) {
      // Merges even a zero-quantity row, preserving the "every item has at
      // least one item_locations row" invariant when this was the item's
      // only bucket, not just its quantity.
      await upsertBucketQuantity(tx, row.pantryItemId, null, row.quantity);
    }

    await tx
      .delete(itemLocations)
      .where(eq(itemLocations.locationId, locationId));

    const [deleted] = await tx
      .delete(locations)
      .where(scopedToLocation(householdId, locationId))
      .returning();

    return deleted;
  });
}
