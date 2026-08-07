export const PANTRY_ITEM_UNITS = [
  "count",
  "g",
  "kg",
  "ml",
  "l",
  "box",
  "bag",
  "pack",
] as const;

export type PantryItemUnit = (typeof PANTRY_ITEM_UNITS)[number];

export function isPantryItemUnit(value: string): value is PantryItemUnit {
  return (PANTRY_ITEM_UNITS as readonly string[]).includes(value);
}

// Used to compare item names case-insensitively (ADR 0001) — trims
// incidental whitespace too, so " Rice" and "rice " are treated the same.
export function normalizePantryItemName(name: string): string {
  return name.trim().toLowerCase();
}

// Quantity is stored as Drizzle's numeric-as-string (see src/db/schema/app.ts)
// to avoid float precision loss, so validation stays string-based rather than
// round-tripping the value through `Number`. Requires a leading digit (no
// negative sign, no bare ".5", no scientific notation) so "reject negative
// quantities" is enforced by the pattern itself rather than a separate check.
const QUANTITY_PATTERN = /^\d+(\.\d+)?$/;

export function parseQuantity(raw: string): string | null {
  const trimmed = raw.trim();
  return QUANTITY_PATTERN.test(trimmed) ? trimmed : null;
}

// One scannable number per row (ADR 0004) — the unit-less "count" default
// postfixes nothing, every other unit postfixes its label.
export function formatQuantity(quantity: string, unit: PantryItemUnit): string {
  const amount = Number(quantity).toString();
  return unit === "count" ? amount : `${amount} ${unit}`;
}

export function incrementQuantity(quantity: string): string {
  return (Number(quantity) + 1).toString();
}

// Floors at zero (PER-226) — a signed-in user can never drive a quantity
// negative, regardless of the value already stored, mirroring the DB's
// pantry_items_quantity_non_negative check.
export function decrementQuantity(quantity: string): string {
  const next = Number(quantity) - 1;
  return next > 0 ? next.toString() : "0";
}

export type PantrySortColumn = "name" | "amount";
export type PantrySortDirection = "ascending" | "descending";
export type PantrySortState = {
  column: PantrySortColumn;
  direction: PantrySortDirection;
} | null;

// Three-state cycle per header (ADR 0004, PER-249): ascending -> descending
// -> default (null), one column active at a time. Switching columns always
// restarts at ascending regardless of the previous column's direction.
export function nextPantrySortState(
  current: PantrySortState,
  column: PantrySortColumn,
): PantrySortState {
  if (!current || current.column !== column) {
    return { column, direction: "ascending" };
  }
  return current.direction === "ascending"
    ? { column, direction: "descending" }
    : null;
}

type SortableItem = { name: string; quantity: string };

// Amount sorts by the raw numeric quantity only, ignoring unit (ADR 0004) —
// units carry no conversion behavior, so there's no meaningful cross-unit
// order. Ties fall back to the incoming order via Array#sort's guaranteed
// stability, which is the default createdAt-ascending order items already
// arrive in from the server query — no explicit tiebreak needed.
export function sortPantryItems<T extends SortableItem>(
  items: T[],
  sortState: PantrySortState,
): T[] {
  if (!sortState) {
    return items;
  }
  const sign = sortState.direction === "ascending" ? 1 : -1;
  // "accent" sensitivity is case-insensitive but keeps accented letters
  // distinct from their unaccented base (unlike "base", which would also
  // fold e.g. Swedish "a" and "ä" together) — matching the ticket's
  // "case-insensitive" (not "diacritic-insensitive") requirement.
  const compare: (a: T, b: T) => number =
    sortState.column === "name"
      ? (a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "accent" })
      : (a, b) => Number(a.quantity) - Number(b.quantity);
  return [...items].sort((a, b) => compare(a, b) * sign);
}

export type PantryItemFormInput = {
  name: string;
  quantity: string;
  unit: PantryItemUnit;
  // Optional so existing callers that don't care about the threshold (e.g.
  // most add/adjust call sites) don't have to spell out "unset" — callers
  // that omit it get the same "no threshold" behavior as passing null.
  minimumQuantity?: string | null;
};

export type ParsePantryItemInputResult =
  { ok: true; value: PantryItemFormInput } | { ok: false; error: string };

export function parsePantryItemInput(
  formData: FormData,
): ParsePantryItemInputResult {
  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  const rawQuantity = formData.get("quantity");
  const quantity =
    typeof rawQuantity === "string" ? parseQuantity(rawQuantity) : null;
  if (quantity === null) {
    return {
      ok: false,
      error: "Quantity must be zero or a positive number.",
    };
  }

  const rawUnit = formData.get("unit");
  const unit =
    typeof rawUnit === "string" && rawUnit !== "" ? rawUnit : "count";
  if (!isPantryItemUnit(unit)) {
    return { ok: false, error: "Choose a valid unit." };
  }

  // Blank input leaves low-stock tracking off (CONTEXT.md "Minimum
  // quantity") rather than being rejected — only a non-blank, invalid value
  // is a validation error.
  const rawMinimumQuantity = formData.get("minimumQuantity");
  let minimumQuantity: string | null = null;
  if (typeof rawMinimumQuantity === "string" && rawMinimumQuantity.trim()) {
    minimumQuantity = parseQuantity(rawMinimumQuantity);
    if (minimumQuantity === null) {
      return {
        ok: false,
        error: "Minimum quantity must be zero or a positive number.",
      };
    }
  }

  return { ok: true, value: { name, quantity, unit, minimumQuantity } };
}

export type PantryItemStockStatus = "in-stock" | "low-stock" | "out-of-stock";

// Mutually exclusive by construction (CONTEXT.md "Low stock"): a zeroed
// item is out of stock only, regardless of its minimum quantity, so the
// zero check comes first. An item with no minimum quantity set is never
// low stock.
export function getPantryItemStockStatus(
  quantity: string,
  minimumQuantity: string | null,
): PantryItemStockStatus {
  if (Number(quantity) === 0) {
    return "out-of-stock";
  }
  if (minimumQuantity !== null && Number(quantity) <= Number(minimumQuantity)) {
    return "low-stock";
  }
  return "in-stock";
}

export type PantryStatusFilter = Record<PantryItemStockStatus, boolean>;

export const DEFAULT_STATUS_FILTER: PantryStatusFilter = {
  "in-stock": true,
  "low-stock": true,
  "out-of-stock": true,
};

export function isDefaultStatusFilter(filter: PantryStatusFilter): boolean {
  return filter["in-stock"] && filter["low-stock"] && filter["out-of-stock"];
}

export function activeStatusFilterCount(filter: PantryStatusFilter): number {
  return Object.values(filter).filter(Boolean).length;
}

type StatusFilterableItem = {
  quantity: string;
  minimumQuantity: string | null;
};

// A pure client-side transform over the fetched row list (ADR 0004,
// PER-251), composing with sortPantryItems the same way PER-249's sort
// does — neither is a server query.
export function filterPantryItemsByStatus<T extends StatusFilterableItem>(
  items: T[],
  filter: PantryStatusFilter,
): T[] {
  return items.filter(
    (item) =>
      filter[getPantryItemStockStatus(item.quantity, item.minimumQuantity)],
  );
}
