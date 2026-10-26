import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaimsMock = vi.fn();
const getHouseholdForUserMock = vi.fn();
const removeBarcodeRegistrationMock = vi.fn();
const updateBarcodeQuantityPerScanMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: getClaimsMock } }),
}));

vi.mock("@/lib/household", () => ({
  getHouseholdForUser: getHouseholdForUserMock,
}));

vi.mock("@/lib/barcode-registrations", () => ({
  removeBarcodeRegistration: removeBarcodeRegistrationMock,
  updateBarcodeQuantityPerScan: updateBarcodeQuantityPerScanMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/db/client", () => ({ db: {} }));

const { removeItemRegistration, updateItemRegistrationQuantityPerScan } =
  await import("./registration-actions");

const REGISTRATION_ID = "55555555-5555-5555-5555-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  getHouseholdForUserMock.mockResolvedValue({ id: "household-1" });
});

describe("removeItemRegistration", () => {
  it("removes the registration from the signed-in user's household", async () => {
    removeBarcodeRegistrationMock.mockResolvedValue(true);

    expect(await removeItemRegistration(REGISTRATION_ID)).toEqual({ ok: true });
    expect(removeBarcodeRegistrationMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "household-1",
      REGISTRATION_ID,
    );
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("reports a registration that isn't in the household as not found", async () => {
    removeBarcodeRegistrationMock.mockResolvedValue(false);

    expect(await removeItemRegistration(REGISTRATION_ID)).toEqual({
      ok: false,
      error: "Barcode not found.",
    });
  });

  it("treats a malformed id as not found without querying", async () => {
    expect(await removeItemRegistration("not-a-uuid")).toEqual({
      ok: false,
      error: "Barcode not found.",
    });
    expect(removeBarcodeRegistrationMock).not.toHaveBeenCalled();
  });
});

describe("updateItemRegistrationQuantityPerScan", () => {
  it("saves a positive decimal amount", async () => {
    updateBarcodeQuantityPerScanMock.mockResolvedValue(true);

    expect(
      await updateItemRegistrationQuantityPerScan(REGISTRATION_ID, " 0.5 "),
    ).toEqual({
      ok: true,
    });
    expect(updateBarcodeQuantityPerScanMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "household-1",
      REGISTRATION_ID,
      "0.5",
    );
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it.each(["0", "0.0", "-1", "abc", ""])(
    "rejects %j without saving",
    async (amount) => {
      expect(
        await updateItemRegistrationQuantityPerScan(REGISTRATION_ID, amount),
      ).toEqual({
        ok: false,
        error: "Amount must be a positive number.",
      });
      expect(updateBarcodeQuantityPerScanMock).not.toHaveBeenCalled();
    },
  );

  it("reports a registration that isn't in the household as not found", async () => {
    updateBarcodeQuantityPerScanMock.mockResolvedValue(false);

    expect(
      await updateItemRegistrationQuantityPerScan(REGISTRATION_ID, "2"),
    ).toEqual({
      ok: false,
      error: "Barcode not found.",
    });
  });
});
