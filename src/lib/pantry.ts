// PROTOTYPE mock data (PER-218) — no backend, resets on reload.

export type Unit = "count" | "g" | "kg" | "ml" | "l" | "box" | "bag" | "pack";

export const UNITS: Unit[] = [
  "count",
  "g",
  "kg",
  "ml",
  "l",
  "box",
  "bag",
  "pack",
];

export type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
};

export const SEED_ITEMS: PantryItem[] = [
  { id: "1", name: "Rice", quantity: 2, unit: "kg" },
  { id: "2", name: "Olive oil", quantity: 1, unit: "l" },
  { id: "3", name: "Eggs", quantity: 6, unit: "count" },
  { id: "4", name: "Pasta", quantity: 3, unit: "box" },
  { id: "5", name: "Milk", quantity: 0, unit: "l" },
  { id: "6", name: "Coffee", quantity: 250, unit: "g" },
  { id: "7", name: "Black beans", quantity: 0, unit: "box" },
  { id: "8", name: "Paper towels", quantity: 4, unit: "pack" },
];

export function findByName(
  items: PantryItem[],
  name: string,
): PantryItem | undefined {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return undefined;
  return items.find((item) => item.name.trim().toLowerCase() === trimmed);
}
