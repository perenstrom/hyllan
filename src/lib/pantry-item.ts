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
