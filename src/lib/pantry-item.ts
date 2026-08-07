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
  const compare: (a: T, b: T) => number =
    sortState.column === "name"
      ? (a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      : (a, b) => Number(a.quantity) - Number(b.quantity);
  return [...items].sort((a, b) => compare(a, b) * sign);
}

export type PantryItemFormInput = {
  name: string;
  quantity: string;
  unit: PantryItemUnit;
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

  return { ok: true, value: { name, quantity, unit } };
}
