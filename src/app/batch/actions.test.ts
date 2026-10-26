import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaimsMock = vi.fn();
const getHouseholdForUserMock = vi.fn();
const addPantryItemMock = vi.fn();
const adjustPantryItemQuantityMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: getClaimsMock } }),
}));

vi.mock("@/lib/household", () => ({
  getHouseholdForUser: getHouseholdForUserMock,
}));

class PantryItemUnitMismatchError extends Error {
  constructor(
    public readonly itemName: string,
    public readonly unit: string,
  ) {
    super();
  }
}

vi.mock("@/lib/pantry-items", () => ({
  addPantryItem: addPantryItemMock,
  adjustPantryItemQuantity: adjustPantryItemQuantityMock,
  PantryItemUnitMismatchError,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/db/client", () => ({ db: {} }));

const { adjustBatchItem, createBatchItem } = await import("./actions");

function itemWithTotal(quantity: string) {
  return { id: "item-1", name: "Rice", unit: "kg", quantity, buckets: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  getHouseholdForUserMock.mockResolvedValue({ id: "household-1" });
});

describe("adjustBatchItem", () => {
  it("applies the signed delta to the item's unassigned bucket and reports the resulting entry", async () => {
    adjustPantryItemQuantityMock.mockResolvedValue({
      item: itemWithTotal("1"),
      appliedDelta: "-2",
    });

    const result = await adjustBatchItem("item-1", "-3");

    expect(adjustPantryItemQuantityMock).toHaveBeenCalledWith(
      {},
      "household-1",
      "item-1",
      null,
      "-3",
    );
    expect(result).toEqual({
      ok: true,
      entry: {
        itemId: "item-1",
        itemName: "Rice",
        unit: "kg",
        delta: "-2",
        total: "1",
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("rejects a malformed delta without touching the item", async () => {
    const result = await adjustBatchItem("item-1", "abc");

    expect(result).toEqual({
      ok: false,
      error: "Quantity must be a number.",
    });
    expect(adjustPantryItemQuantityMock).not.toHaveBeenCalled();
  });

  it("reports an item missing from the household", async () => {
    adjustPantryItemQuantityMock.mockResolvedValue(undefined);

    const result = await adjustBatchItem("item-1", "1");

    expect(result).toEqual({ ok: false, error: "Item not found." });
  });
});

describe("createBatchItem", () => {
  it("creates the item in the unassigned bucket, counted, and reports the resulting entry", async () => {
    addPantryItemMock.mockResolvedValue({
      id: "item-2",
      name: "Lentils",
      unit: "count",
      quantity: "2",
      buckets: [],
    });

    const result = await createBatchItem("  Lentils ", "2");

    expect(addPantryItemMock).toHaveBeenCalledWith({}, "household-1", {
      name: "Lentils",
      quantity: "2",
      unit: "count",
      locationId: null,
    });
    expect(result).toEqual({
      ok: true,
      entry: {
        itemId: "item-2",
        itemName: "Lentils",
        unit: "count",
        delta: "2",
        total: "2",
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("requires a name", async () => {
    const result = await createBatchItem("  ", "2");

    expect(result).toEqual({ ok: false, error: "Name is required." });
    expect(addPantryItemMock).not.toHaveBeenCalled();
  });

  it("requires a positive quantity", async () => {
    const result = await createBatchItem("Lentils", "0");

    expect(result).toEqual({
      ok: false,
      error: "Quantity must be a positive number.",
    });
    expect(addPantryItemMock).not.toHaveBeenCalled();
  });

  it("explains a unit mismatch against an existing same-named item", async () => {
    addPantryItemMock.mockRejectedValue(
      new PantryItemUnitMismatchError("Lentils", "kg"),
    );

    const result = await createBatchItem("lentils", "2");

    expect(result).toEqual({
      ok: false,
      error:
        "Lentils is already tracked in kg. Pick it from the list to add to it.",
    });
  });
});
