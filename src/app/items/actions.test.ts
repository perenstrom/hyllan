import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaimsMock = vi.fn();
const getHouseholdForUserMock = vi.fn();
const addPantryItemMock = vi.fn();
const incrementPantryItemQuantityMock = vi.fn();
const decrementPantryItemQuantityMock = vi.fn();
const deletePantryItemMock = vi.fn();
const updatePantryItemMock = vi.fn();
const redirectMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: getClaimsMock } }),
}));

vi.mock("@/lib/household", () => ({
  getHouseholdForUser: getHouseholdForUserMock,
}));

class DuplicatePantryItemNameError extends Error {}
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
  incrementPantryItemQuantity: incrementPantryItemQuantityMock,
  decrementPantryItemQuantity: decrementPantryItemQuantityMock,
  deletePantryItem: deletePantryItemMock,
  updatePantryItem: updatePantryItemMock,
  DuplicatePantryItemNameError,
  PantryItemUnitMismatchError,
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

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/db/client", () => ({ db: {} }));

const { addItem, decrementItem, deleteItem, editItem, incrementItem } =
  await import("./actions");

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
      { name: "Rice", quantity: "2", unit: "kg", minimumQuantity: null },
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

  it("returns a friendly error naming the existing unit when the add's unit doesn't match", async () => {
    addPantryItemMock.mockRejectedValue(
      new PantryItemUnitMismatchError("Rice", "kg"),
    );

    const state = await addItem(
      undefined,
      formDataOf({ name: "Rice", quantity: "3", unit: "bag" }),
    );

    expect(state).toEqual({
      error:
        "Rice is already tracked in kg. Enter this amount in kg, or edit the item to change its unit.",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("incrementItem / decrementItem / deleteItem", () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
    getHouseholdForUserMock.mockReset();
    incrementPantryItemQuantityMock.mockReset();
    decrementPantryItemQuantityMock.mockReset();
    deletePantryItemMock.mockReset();
    revalidatePathMock.mockReset();
    redirectMock.mockReset();

    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    getHouseholdForUserMock.mockResolvedValue({ id: "household-1" });
  });

  it("increments the item within the signed-in user's household and revalidates the list", async () => {
    await incrementItem("item-1");

    expect(incrementPantryItemQuantityMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "household-1",
      "item-1",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("decrements the item within the signed-in user's household and revalidates the list", async () => {
    await decrementItem("item-1");

    expect(decrementPantryItemQuantityMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "household-1",
      "item-1",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("deletes the item within the signed-in user's household and revalidates the list", async () => {
    await deleteItem("item-1");

    expect(deletePantryItemMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "household-1",
      "item-1",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("redirects to login when there is no session, without mutating anything", async () => {
    getClaimsMock.mockResolvedValue({ data: null });

    await expect(incrementItem("item-1")).rejects.toThrow("REDIRECT:/login");
    expect(incrementPantryItemQuantityMock).not.toHaveBeenCalled();
  });
});

describe("editItem", () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
    getHouseholdForUserMock.mockReset();
    updatePantryItemMock.mockReset();
    redirectMock.mockReset();

    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    getHouseholdForUserMock.mockResolvedValue({ id: "household-1" });
  });

  it("updates the item within the signed-in user's household and redirects home", async () => {
    updatePantryItemMock.mockResolvedValue({ id: "item-1" });

    await expect(
      editItem(
        "item-1",
        undefined,
        formDataOf({ name: "Beans", quantity: "3", unit: "kg" }),
      ),
    ).rejects.toThrow("REDIRECT:/");

    expect(updatePantryItemMock).toHaveBeenCalledExactlyOnceWith(
      {},
      "household-1",
      "item-1",
      { name: "Beans", quantity: "3", unit: "kg", minimumQuantity: null },
    );
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("returns a validation error without touching the database", async () => {
    const state = await editItem(
      "item-1",
      undefined,
      formDataOf({ name: "", quantity: "2" }),
    );

    expect(state).toEqual({ error: "Name is required." });
    expect(updatePantryItemMock).not.toHaveBeenCalled();
  });

  it("returns an error when the item doesn't belong to the signed-in user's household", async () => {
    updatePantryItemMock.mockResolvedValue(undefined);

    const state = await editItem(
      "item-1",
      undefined,
      formDataOf({ name: "Beans", quantity: "3", unit: "kg" }),
    );

    expect(state).toEqual({ error: "Item not found." });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the new name collides with another item", async () => {
    updatePantryItemMock.mockRejectedValue(new DuplicatePantryItemNameError());

    const state = await editItem(
      "item-1",
      undefined,
      formDataOf({ name: "Beans", quantity: "3", unit: "kg" }),
    );

    expect(state).toEqual({
      error: "You already have an item with that name.",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
