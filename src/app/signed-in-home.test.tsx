import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const decrementItemMock = vi.fn();
const incrementItemMock = vi.fn();
const deleteItemMock = vi.fn();

// signed-in-home.tsx binds these server actions directly to form actions
// (Next's documented pattern for passing extra args), so importing it pulls
// in "@/db/client" transitively — mock the actions module the same way
// add-item-form.test.tsx mocks "../actions" to avoid needing DATABASE_URL.
vi.mock("./items/actions", () => ({
  decrementItem: (...args: unknown[]) => decrementItemMock(...args),
  incrementItem: (...args: unknown[]) => incrementItemMock(...args),
  deleteItem: (...args: unknown[]) => deleteItemMock(...args),
}));

// The header's account menu binds these the same way — deleteAccount pulls
// in "@/db/client" transitively too, so it needs the same treatment.
vi.mock("./actions", () => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));

const { SignedInHome } = await import("./signed-in-home");

function itemRow(
  overrides: Partial<Parameters<typeof SignedInHome>[0]["items"][number]> = {},
) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    householdId: "22222222-2222-2222-2222-222222222222",
    name: "Rice",
    quantity: "2",
    unit: "kg" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("SignedInHome", () => {
  beforeEach(() => {
    decrementItemMock.mockReset();
    incrementItemMock.mockReset();
    deleteItemMock.mockReset();
  });

  it("shows the empty state when there are no items", () => {
    render(<SignedInHome items={[]} />);

    expect(screen.getByText("Your pantry is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a row per item with the unit postfixed onto the amount", () => {
    render(<SignedInHome items={[itemRow()]} />);

    expect(screen.getByRole("cell", { name: "Rice" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2 kg" })).toBeInTheDocument();
  });

  it("omits the unit for the unit-less count default", () => {
    render(
      <SignedInHome
        items={[itemRow({ name: "Eggs", quantity: "6", unit: "count" })]}
      />,
    );

    expect(screen.getByRole("cell", { name: "6" })).toBeInTheDocument();
  });

  it("keeps a zero-quantity item visible, with a screen-reader-only out-of-stock label", () => {
    render(<SignedInHome items={[itemRow({ quantity: "0" })]} />);

    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toHaveClass("sr-only");
  });

  it("tints an out-of-stock row's background instead of showing a visible label", () => {
    render(<SignedInHome items={[itemRow({ quantity: "0" })]} />);

    const row = screen.getByText("Rice").closest("tr");
    expect(row).toHaveClass("bg-red-100", "dark:bg-red-950");
  });

  it("does not label or tint an in-stock item as out of stock", () => {
    render(<SignedInHome items={[itemRow()]} />);

    expect(screen.queryByText("Out of stock")).not.toBeInTheDocument();
    const row = screen.getByText("Rice").closest("tr");
    expect(row).not.toHaveClass("bg-red-100");
  });

  it("shrinks the content container's padding below sm, restoring it at/above sm", () => {
    render(<SignedInHome items={[]} />);

    const main = screen.getByRole("main");
    expect(main).toHaveClass("px-2", "py-5", "sm:px-6", "sm:py-6");
  });

  it("drops the table wrapper's border and rounded corners below sm, restoring them at/above sm", () => {
    render(<SignedInHome items={[itemRow()]} />);

    const wrapper = screen.getByRole("table").parentElement as HTMLElement;
    expect(wrapper).not.toHaveClass("border", "rounded-lg");
    expect(wrapper).toHaveClass(
      "sm:rounded-lg",
      "sm:border",
      "sm:border-zinc-200",
      "dark:sm:border-zinc-800",
    );
  });

  it("links the add-item action to the focused form", () => {
    render(<SignedInHome items={[]} />);

    expect(screen.getByRole("link", { name: "+ Add item" })).toHaveAttribute(
      "href",
      "/items/new",
    );
  });

  it("renders increment/decrement/edit/delete controls per item", () => {
    render(<SignedInHome items={[itemRow()]} />);

    expect(
      screen.getByRole("button", { name: "Increase Rice quantity" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Decrease Rice quantity" }),
    ).toBeEnabled();
    expect(screen.getByRole("link", { name: "Edit Rice" })).toHaveAttribute(
      "href",
      "/items/11111111-1111-1111-1111-111111111111/edit",
    );
    expect(
      screen.getByRole("button", { name: "Delete Rice" }),
    ).toBeInTheDocument();
  });

  function getActionsContainer() {
    const decrementForm = screen
      .getByRole("button", { name: "Decrease Rice quantity" })
      .closest("form");
    return decrementForm?.parentElement as HTMLElement;
  }

  it("lays the actions out as a 2x2 grid below sm, a single row at/above it", () => {
    render(<SignedInHome items={[itemRow()]} />);

    expect(getActionsContainer()).toHaveClass("grid", "grid-cols-2", "sm:flex");
  });

  it("orders the actions decrement, increment, edit, delete so the grid wraps them 2x2 in that order", () => {
    render(<SignedInHome items={[itemRow()]} />);

    const controls = Array.from(
      getActionsContainer().querySelectorAll("button, a"),
    );

    expect(controls.map((el) => el.getAttribute("aria-label"))).toEqual([
      "Decrease Rice quantity",
      "Increase Rice quantity",
      "Edit Rice",
      "Delete Rice",
    ]);
  });

  it("sizes the table's minimum width for the 2x2 actions grid so it fits a 375px viewport", () => {
    render(<SignedInHome items={[itemRow()]} />);

    const table = screen.getByRole("table");

    expect(table).not.toHaveClass("min-w-[480px]");
    expect(table).toHaveClass("min-w-[320px]");
  });

  it("disables the decrement control once an item is out of stock", () => {
    render(<SignedInHome items={[itemRow({ quantity: "0" })]} />);

    expect(
      screen.getByRole("button", { name: "Decrease Rice quantity" }),
    ).toBeDisabled();
  });

  it("shows the incremented amount immediately, before the server action resolves", async () => {
    let resolveIncrement: () => void = () => {};
    incrementItemMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveIncrement = resolve;
      }),
    );

    render(<SignedInHome items={[itemRow({ quantity: "2" })]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Increase Rice quantity" }),
    );

    expect(await screen.findByRole("cell", { name: "3 kg" })).toBeInTheDocument();
    expect(incrementItemMock).toHaveBeenCalledExactlyOnceWith(
      "11111111-1111-1111-1111-111111111111",
    );

    resolveIncrement();
  });

  it("shows the decremented amount immediately, before the server action resolves", async () => {
    let resolveDecrement: () => void = () => {};
    decrementItemMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDecrement = resolve;
      }),
    );

    render(<SignedInHome items={[itemRow({ quantity: "2" })]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Decrease Rice quantity" }),
    );

    expect(await screen.findByRole("cell", { name: "1 kg" })).toBeInTheDocument();
    expect(decrementItemMock).toHaveBeenCalledExactlyOnceWith(
      "11111111-1111-1111-1111-111111111111",
    );

    resolveDecrement();
  });

  it("optimistically floors the decrement at zero, mirroring the server's clamp", async () => {
    let resolveDecrement: () => void = () => {};
    decrementItemMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDecrement = resolve;
      }),
    );

    render(<SignedInHome items={[itemRow({ quantity: "0.5" })]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Decrease Rice quantity" }),
    );

    expect(await screen.findByText("Out of stock")).toHaveClass("sr-only");

    resolveDecrement();
  });
});
