import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaimsMock = vi.fn();
const getHouseholdForUserMock = vi.fn();
const addLocationMock = vi.fn();
const renameLocationMock = vi.fn();
const deleteLocationMock = vi.fn();
const setPantryItemLocationQuantityMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: getClaimsMock } }),
}));

vi.mock("@/lib/household", () => ({
  getHouseholdForUser: getHouseholdForUserMock,
}));

class DuplicateLocationNameError extends Error {}

vi.mock("@/lib/locations", () => ({
  addLocation: addLocationMock,
  renameLocation: renameLocationMock,
  deleteLocation: deleteLocationMock,
  DuplicateLocationNameError,
}));

vi.mock("@/lib/pantry-items", () => ({
  setPantryItemLocationQuantity: setPantryItemLocationQuantityMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/db/client", () => ({ db: {} }));

const {
  createLocation,
  deleteLocationAction,
  renameLocationAction,
  setStockTakeQuantity,
} = await import("./actions");

describe("createLocation", () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
    getHouseholdForUserMock.mockReset();
    addLocationMock.mockReset();
    revalidatePathMock.mockReset();

    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    getHouseholdForUserMock.mockResolvedValue({ id: "household-1" });
  });

  it("creates the location for the signed-in user's household and revalidates", async () => {
    addLocationMock.mockResolvedValue({ id: "loc-1", name: "Pantry" });

    const result = await createLocation("Pantry");

    expect(addLocationMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "household-1",
      "Pantry",
    );
    expect(result).toEqual({
      ok: true,
      location: { id: "loc-1", name: "Pantry" },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/locations");
  });

  it("rejects a blank name without touching the database", async () => {
    const result = await createLocation("   ");

    expect(result).toEqual({
      ok: false,
      error: "Location name is required.",
    });
    expect(addLocationMock).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the name already exists", async () => {
    addLocationMock.mockRejectedValue(new DuplicateLocationNameError());

    const result = await createLocation("Pantry");

    expect(result).toEqual({
      ok: false,
      error: "You already have a location with that name.",
    });
  });
});

describe("renameLocationAction", () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
    getHouseholdForUserMock.mockReset();
    renameLocationMock.mockReset();
    revalidatePathMock.mockReset();

    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    getHouseholdForUserMock.mockResolvedValue({ id: "household-1" });
  });

  it("renames the location and revalidates", async () => {
    renameLocationMock.mockResolvedValue({ id: "loc-1", name: "Kitchen" });

    const result = await renameLocationAction("loc-1", "Kitchen");

    expect(renameLocationMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "household-1",
      "loc-1",
      "Kitchen",
    );
    expect(result).toEqual({
      ok: true,
      location: { id: "loc-1", name: "Kitchen" },
    });
  });

  it("returns an error when the location doesn't belong to the household", async () => {
    renameLocationMock.mockResolvedValue(undefined);

    const result = await renameLocationAction("loc-1", "Kitchen");

    expect(result).toEqual({ ok: false, error: "Location not found." });
  });

  it("returns a friendly error when the new name collides", async () => {
    renameLocationMock.mockRejectedValue(new DuplicateLocationNameError());

    const result = await renameLocationAction("loc-1", "Freezer");

    expect(result).toEqual({
      ok: false,
      error: "You already have a location with that name.",
    });
  });
});

describe("deleteLocationAction", () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
    getHouseholdForUserMock.mockReset();
    deleteLocationMock.mockReset();
    revalidatePathMock.mockReset();

    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    getHouseholdForUserMock.mockResolvedValue({ id: "household-1" });
  });

  it("deletes the location within the signed-in user's household and revalidates", async () => {
    await deleteLocationAction("loc-1");

    expect(deleteLocationMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "household-1",
      "loc-1",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/locations");
  });
});

describe("setStockTakeQuantity", () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
    getHouseholdForUserMock.mockReset();
    setPantryItemLocationQuantityMock.mockReset();
    revalidatePathMock.mockReset();

    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    getHouseholdForUserMock.mockResolvedValue({ id: "household-1" });
  });

  it("sets the item's quantity at the location within the signed-in user's household and revalidates", async () => {
    setPantryItemLocationQuantityMock.mockResolvedValue({ id: "item-1" });

    const result = await setStockTakeQuantity("item-1", "loc-1", "7");

    expect(setPantryItemLocationQuantityMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "household-1",
      "item-1",
      "loc-1",
      "7",
    );
    expect(result).toEqual({ ok: true, quantity: "7" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/locations");
  });

  it("rejects a malformed quantity without touching the database", async () => {
    const result = await setStockTakeQuantity("item-1", "loc-1", "-2");

    expect(result).toEqual({
      ok: false,
      error: "Quantity must be zero or a positive number.",
    });
    expect(setPantryItemLocationQuantityMock).not.toHaveBeenCalled();
  });

  it("accepts zero", async () => {
    setPantryItemLocationQuantityMock.mockResolvedValue({ id: "item-1" });

    const result = await setStockTakeQuantity("item-1", "loc-1", "0");

    expect(result).toEqual({ ok: true, quantity: "0" });
  });

  it("returns an error when the item doesn't belong to the household", async () => {
    setPantryItemLocationQuantityMock.mockResolvedValue(undefined);

    const result = await setStockTakeQuantity("item-1", "loc-1", "7");

    expect(result).toEqual({ ok: false, error: "Item not found." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
