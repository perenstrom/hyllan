// PROTOTYPE — wipe me. Answers PER-268 (Wayfinder map PER-264). No real
// Location schema exists yet (ADR 0005 settled the model, not the UI), so
// this fabricates a per-location breakdown for each real pantry item,
// client-side, in memory only. Never wired to a server action.

export const UNASSIGNED = "unassigned" as const;
export type LocationKey = string;

export type LocationBreakdown = Record<LocationKey, number>;

export const DEFAULT_LOCATIONS = ["Pantry", "Garage fridge", "Freezer"];

// Deterministic on item id, not random — so refreshing the page (or
// flipping between variants) doesn't reshuffle which items look
// single-location, multi-location, or fully unassigned while you're
// reacting to the mockups.
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Splits `quantity` across 0-3 of the given locations plus the unassigned
// bucket, varied by a hash of the item id purely to exercise every case
// (all-unassigned, single-location, multi-location) across a real item
// list. Not a real distribution algorithm.
export function mockBreakdown(
  itemId: string,
  quantity: number,
  locations: string[],
): LocationBreakdown {
  const breakdown: LocationBreakdown = { [UNASSIGNED]: quantity };
  if (quantity <= 0 || locations.length === 0) {
    return breakdown;
  }

  const pattern = hashString(itemId) % 4; // 0: all unassigned, 1-3: N locations active
  if (pattern === 0) {
    return breakdown;
  }

  const activeCount = Math.min(pattern, locations.length);
  const active = locations.slice(0, activeCount);
  const share = Math.floor(quantity / (activeCount + 1)) || 1;

  let remaining = quantity;
  for (const location of active) {
    const amount = Math.min(share, remaining);
    breakdown[location] = amount;
    remaining -= amount;
  }
  breakdown[UNASSIGNED] = remaining;
  return breakdown;
}

export function breakdownTotal(breakdown: LocationBreakdown): number {
  return Object.values(breakdown).reduce((sum, value) => sum + value, 0);
}

// Buckets with quantity > 0, unassigned always last regardless of amount —
// it's the fallback, not a location a household named.
export function activeBuckets(
  breakdown: LocationBreakdown,
): [LocationKey, number][] {
  const entries = Object.entries(breakdown).filter(
    ([key, amount]) => amount > 0 || key === UNASSIGNED,
  );
  return entries.sort((a, b) => {
    if (a[0] === UNASSIGNED) return 1;
    if (b[0] === UNASSIGNED) return -1;
    return 0;
  });
}

// Which location keys a location filter should treat this item as
// belonging to: every bucket actually holding quantity, or Unassigned
// alone for a zeroed item that holds none anywhere.
export function involvedBuckets(breakdown: LocationBreakdown): LocationKey[] {
  const withQuantity = Object.entries(breakdown)
    .filter(([, amount]) => amount > 0)
    .map(([key]) => key);
  return withQuantity.length > 0 ? withQuantity : [UNASSIGNED];
}
