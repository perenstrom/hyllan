import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaimsMock = vi.fn();
const getHouseholdForUserMock = vi.fn();
const addPantryItemMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: getClaimsMock } }),
}));

vi.mock("@/lib/household", () => ({
  getHouseholdForUser: getHouseholdForUserMock,
}));

vi.mock("@/lib/pantry-items", () => ({
  addPantryItem: addPantryItemMock,
}));

// Next.js's real redirect() always throws to halt execution — mirror that
// here so addItem's early "no session" branch can't fall through into
// reading claims off a null session, the way it would with a plain vi.fn().
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/db/client", () => ({ db: {} }));

const { addItem } = await import("./actions");

function formDataOf(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("addItem", () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
    getHouseholdForUserMock.mockReset();
    addPantryItemMock.mockReset();
    redirectMock.mockReset();

    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    getHouseholdForUserMock.mockResolvedValue({ id: "household-1" });
  });

  it("adds the item to the signed-in user's household and redirects home", async () => {
    await expect(
      addItem(
        undefined,
        formDataOf({ name: "Rice", quantity: "2", unit: "kg" }),
      ),
    ).rejects.toThrow("REDIRECT:/");

    expect(getHouseholdForUserMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "user-1",
    );
    expect(addPantryItemMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "household-1",
      { name: "Rice", quantity: "2", unit: "kg" },
    );
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("returns a validation error without touching the household or database", async () => {
    const state = await addItem(
      undefined,
      formDataOf({ name: "", quantity: "2" }),
    );

    expect(state).toEqual({ error: "Name is required." });
    expect(getHouseholdForUserMock).not.toHaveBeenCalled();
    expect(addPantryItemMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rejects a negative quantity without touching the database", async () => {
    const state = await addItem(
      undefined,
      formDataOf({ name: "Rice", quantity: "-2" }),
    );

    expect(state).toEqual({
      error: "Quantity must be zero or a positive number.",
    });
    expect(addPantryItemMock).not.toHaveBeenCalled();
  });

  it("redirects to login when there is no session", async () => {
    getClaimsMock.mockResolvedValue({ data: null });

    await expect(
      addItem(
        undefined,
        formDataOf({ name: "Rice", quantity: "2", unit: "kg" }),
      ),
    ).rejects.toThrow("REDIRECT:/login");

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(addPantryItemMock).not.toHaveBeenCalled();
  });
});
