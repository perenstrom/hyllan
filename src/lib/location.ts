// Used to compare location names case-insensitively (ADR 0005, same rule as
// normalizePantryItemName) — trims incidental whitespace too.
export function normalizeLocationName(name: string): string {
  return name.trim().toLowerCase();
}

export type LocationOption = { id: string; name: string };

// A pantry item's quantity at one Location, or (locationId null) at the
// implicit unassigned bucket (ADR 0005, CONTEXT.md "Location").
export type PantryItemBucket = {
  locationId: string | null;
  locationName: string | null;
  quantity: string;
};

// Sentinel key for the unassigned bucket in filter/hidden-key sets — a
// location's real id (a uuid) can never collide with it.
export const UNASSIGNED_KEY = "unassigned";

export function bucketKey(bucket: Pick<PantryItemBucket, "locationId">) {
  return bucket.locationId ?? UNASSIGNED_KEY;
}

// The buckets an item's row-expansion UI should treat as "holding
// quantity": every bucket with a positive amount, unassigned always last
// regardless of amount. An item with nothing positive anywhere (freshly
// zeroed) still needs exactly one addressable bucket for its top-level +/-
// to act on, so it falls back to the item's actual unassigned row (or a
// zero placeholder if that row doesn't exist) rather than an empty list.
export function activeBuckets(buckets: PantryItemBucket[]): PantryItemBucket[] {
  const positive = buckets.filter((bucket) => Number(bucket.quantity) > 0);
  if (positive.length === 0) {
    const unassigned = buckets.find((bucket) => bucket.locationId === null);
    return [
      {
        locationId: null,
        locationName: null,
        quantity: unassigned?.quantity ?? "0",
      },
    ];
  }
  return [
    ...positive.filter((bucket) => bucket.locationId !== null),
    ...positive.filter((bucket) => bucket.locationId === null),
  ];
}

// The chevron/expansion condition (ticket PER-288): more than one bucket
// (including Unassigned) actually holding quantity.
export function isMultiLocation(buckets: PantryItemBucket[]): boolean {
  return activeBuckets(buckets).length > 1;
}

// The bucket keys (see bucketKey) a location filter should treat this item
// as belonging to.
export function involvedLocationKeys(buckets: PantryItemBucket[]): string[] {
  return activeBuckets(buckets).map(bucketKey);
}

// Active buckets not hidden by the location filter — used to render an
// item's sub-rows (by-item view) without also hiding the whole item, which
// is a separate, item-level check (involvedLocationKeys intersected with
// the visible key set).
export function visibleActiveBuckets(
  buckets: PantryItemBucket[],
  hiddenKeys: ReadonlySet<string>,
): PantryItemBucket[] {
  return activeBuckets(buckets).filter(
    (bucket) => !hiddenKeys.has(bucketKey(bucket)),
  );
}

export function isDefaultLocationFilter(
  hiddenKeys: ReadonlySet<string>,
): boolean {
  return hiddenKeys.size === 0;
}

// An item's displayed total (CONTEXT.md "Quantity") — the sum of every
// bucket it holds, shared by the server (pantry-items.ts) and the client's
// optimistic-update path (signed-in-home.tsx) so both compute it the same
// way.
export function bucketsTotal(
  buckets: Pick<PantryItemBucket, "quantity">[],
): string {
  return buckets
    .reduce((sum, bucket) => sum + Number(bucket.quantity), 0)
    .toString();
}
