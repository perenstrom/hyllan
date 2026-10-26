import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaimsMock = vi.fn();
const getHouseholdForUserMock = vi.fn();
const addPantryItemMock = vi.fn();
const adjustPantryItemQuantityByMock = vi.fn();
const findBarcodeRegistrationMock = vi.fn();
const registerBarcodeMock = vi.fn();
const suggestProductNameMock = vi.fn();
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
  adjustPantryItemQuantityBy: adjustPantryItemQuantityByMock,
  PantryItemUnitMismatchError,
}));

vi.mock("@/lib/barcode-registrations", () => ({
  findBarcodeRegistration: findBarcodeRegistrationMock,
  registerBarcode: registerBarcodeMock,
}));

vi.mock("@/lib/product-names", () => ({
  suggestProductName: suggestProductNameMock,
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

const { registerScannedBarcode, scanBatchBarcode, suggestScannedProductName } =
  await import("./scan-actions");

const EAN = "7310865004703";
const BARCODE = { value: EAN, symbology: "ean_13" as const };

function adjusted(quantity: string, appliedDelta: string) {
  return {
    item: { id: "pasta", name: "Pasta", unit: "count", quantity, buckets: [] },
    appliedDelta,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  getHouseholdForUserMock.mockResolvedValue({ id: "household-1" });
});

describe("scanBatchBarcode", () => {
  it("applies a flat +1 to a registered barcode's item in add mode", async () => {
    findBarcodeRegistrationMock.mockResolvedValue({
      pantryItemId: "pasta",
      itemName: "Pasta",
    });
    adjustPantryItemQuantityByMock.mockResolvedValue(adjusted("4", "1"));

    const result = await scanBatchBarcode(EAN, "ean_13", "add");

    expect(findBarcodeRegistrationMock).toHaveBeenCalledWith(
      {},
      "household-1",
      EAN,
    );
    expect(adjustPantryItemQuantityByMock).toHaveBeenCalledWith(
      {},
      "household-1",
      "pasta",
      null,
      "1",
    );
    expect(result).toEqual({
      ok: true,
      kind: "applied",
      entry: {
        itemId: "pasta",
        itemName: "Pasta",
        unit: "count",
        delta: "1",
        total: "4",
        barcode: BARCODE,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("applies a flat -1 in remove mode", async () => {
    findBarcodeRegistrationMock.mockResolvedValue({
      pantryItemId: "pasta",
      itemName: "Pasta",
    });
    adjustPantryItemQuantityByMock.mockResolvedValue(adjusted("2", "-1"));

    await scanBatchBarcode(EAN, "ean_13", "remove");

    expect(adjustPantryItemQuantityByMock).toHaveBeenCalledWith(
      {},
      "household-1",
      "pasta",
      null,
      "-1",
    );
  });

  it("looks a UPC-A scan up under its EAN-13 form", async () => {
    findBarcodeRegistrationMock.mockResolvedValue(undefined);

    const result = await scanBatchBarcode("036000291452", "upc_a", "add");

    expect(findBarcodeRegistrationMock).toHaveBeenCalledWith(
      {},
      "household-1",
      "0036000291452",
    );
    expect(result).toEqual({
      ok: true,
      kind: "unregistered",
      barcode: { value: "0036000291452", symbology: "upc_a" },
    });
  });

  it("reports an unregistered barcode without changing anything", async () => {
    findBarcodeRegistrationMock.mockResolvedValue(undefined);

    const result = await scanBatchBarcode(EAN, "ean_13", "remove");

    expect(result).toEqual({
      ok: true,
      kind: "unregistered",
      barcode: BARCODE,
    });
    expect(adjustPantryItemQuantityByMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed barcode or unexpected symbology", async () => {
    expect(await scanBatchBarcode("123", "ean_13", "add")).toEqual({
      ok: false,
      error: "That barcode couldn't be read. Try again.",
    });
    expect(await scanBatchBarcode(EAN, "qr_code", "add")).toMatchObject({
      ok: false,
    });
    expect(findBarcodeRegistrationMock).not.toHaveBeenCalled();
  });
});

describe("registerScannedBarcode", () => {
  it("registers the barcode to the picked item and applies +1 in the same action", async () => {
    registerBarcodeMock.mockResolvedValue({ status: "registered" });
    adjustPantryItemQuantityByMock.mockResolvedValue(adjusted("4", "1"));

    const result = await registerScannedBarcode(
      BARCODE,
      { itemId: "pasta" },
      "add",
      false,
    );

    expect(registerBarcodeMock).toHaveBeenCalledWith({}, "household-1", {
      barcodeValue: EAN,
      symbology: "ean_13",
      pantryItemId: "pasta",
      reassign: false,
    });
    expect(result).toEqual({
      ok: true,
      entry: {
        itemId: "pasta",
        itemName: "Pasta",
        unit: "count",
        delta: "1",
        total: "4",
        barcode: BARCODE,
      },
    });
  });

  it("asks for confirmation instead of applying when the barcode is on another item", async () => {
    registerBarcodeMock.mockResolvedValue({
      status: "conflict",
      registeredTo: { id: "rice", name: "Rice" },
    });

    const result = await registerScannedBarcode(
      BARCODE,
      { itemId: "pasta" },
      "add",
      false,
    );

    expect(result).toEqual({ ok: false, conflict: { itemName: "Rice" } });
    expect(adjustPantryItemQuantityByMock).not.toHaveBeenCalled();
  });

  it("passes a confirmed reassignment through and applies -1 in remove mode", async () => {
    registerBarcodeMock.mockResolvedValue({ status: "registered" });
    adjustPantryItemQuantityByMock.mockResolvedValue(adjusted("2", "-1"));

    await registerScannedBarcode(BARCODE, { itemId: "pasta" }, "remove", true);

    expect(registerBarcodeMock).toHaveBeenCalledWith(
      {},
      "household-1",
      expect.objectContaining({ reassign: true }),
    );
    expect(adjustPantryItemQuantityByMock).toHaveBeenCalledWith(
      {},
      "household-1",
      "pasta",
      null,
      "-1",
    );
  });

  it("creates a new item with one counted, then registers the barcode to it", async () => {
    findBarcodeRegistrationMock.mockResolvedValue(undefined);
    addPantryItemMock.mockResolvedValue({
      id: "fusilli",
      name: "Fusilli",
      unit: "count",
      quantity: "1",
      buckets: [],
    });
    registerBarcodeMock.mockResolvedValue({ status: "registered" });

    const result = await registerScannedBarcode(
      BARCODE,
      { newItemName: " Fusilli " },
      "add",
      false,
    );

    expect(addPantryItemMock).toHaveBeenCalledWith({}, "household-1", {
      name: "Fusilli",
      quantity: "1",
      unit: "count",
      locationId: null,
    });
    expect(registerBarcodeMock).toHaveBeenCalledWith(
      {},
      "household-1",
      expect.objectContaining({ pantryItemId: "fusilli" }),
    );
    expect(result).toEqual({
      ok: true,
      entry: {
        itemId: "fusilli",
        itemName: "Fusilli",
        unit: "count",
        delta: "1",
        total: "1",
        barcode: BARCODE,
      },
    });
  });

  it("checks for a conflict before creating, so an unconfirmed reassignment creates nothing", async () => {
    findBarcodeRegistrationMock.mockResolvedValue({
      pantryItemId: "rice",
      itemName: "Rice",
    });

    const result = await registerScannedBarcode(
      BARCODE,
      { newItemName: "Fusilli" },
      "add",
      false,
    );

    expect(result).toEqual({ ok: false, conflict: { itemName: "Rice" } });
    expect(addPantryItemMock).not.toHaveBeenCalled();
  });

  it("never creates in remove mode", async () => {
    const result = await registerScannedBarcode(
      BARCODE,
      { newItemName: "Fusilli" },
      "remove",
      false,
    );

    expect(result).toMatchObject({ ok: false });
    expect(addPantryItemMock).not.toHaveBeenCalled();
  });

  it("rejects a barcode that isn't in canonical form", async () => {
    const result = await registerScannedBarcode(
      { value: "036000291452", symbology: "upc_a" },
      { itemId: "pasta" },
      "add",
      false,
    );

    expect(result).toMatchObject({ ok: false });
    expect(registerBarcodeMock).not.toHaveBeenCalled();
  });

  it("reports a picked item that's gone from the household", async () => {
    registerBarcodeMock.mockResolvedValue({ status: "item-not-found" });

    expect(
      await registerScannedBarcode(BARCODE, { itemId: "gone" }, "add", false),
    ).toEqual({ ok: false, error: "Item not found." });
  });
});

describe("suggestScannedProductName", () => {
  it("returns the cached-or-looked-up suggestion for a canonical barcode", async () => {
    suggestProductNameMock.mockResolvedValue({
      name: "Fusilli",
      source: "open_food_facts",
    });

    expect(await suggestScannedProductName(EAN)).toEqual({
      name: "Fusilli",
      source: "open_food_facts",
    });
    expect(suggestProductNameMock).toHaveBeenCalledWith({}, EAN);
  });

  it("doesn't look up anything for a malformed value", async () => {
    expect(await suggestScannedProductName("abc")).toBeNull();
    expect(suggestProductNameMock).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null } });

    await expect(suggestScannedProductName(EAN)).rejects.toThrow(/REDIRECT/);
  });
});
