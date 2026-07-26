import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// signed-in-home.tsx binds these server actions directly to form actions
// (Next's documented pattern for passing extra args), so importing it pulls
// in "@/db/client" transitively — mock the actions module the same way
// add-item-form.test.tsx mocks "../actions" to avoid needing DATABASE_URL.
vi.mock("./items/actions", () => ({
  decrementItem: vi.fn(),
  incrementItem: vi.fn(),
  deleteItem: vi.fn(),
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

  it("keeps a zero-quantity item visible, labeled out of stock", () => {
    render(<SignedInHome items={[itemRow({ quantity: "0" })]} />);

    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("does not label an in-stock item as out of stock", () => {
    render(<SignedInHome items={[itemRow()]} />);

    expect(screen.queryByText("Out of stock")).not.toBeInTheDocument();
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

  it("disables the decrement control once an item is out of stock", () => {
    render(<SignedInHome items={[itemRow({ quantity: "0" })]} />);

    expect(
      screen.getByRole("button", { name: "Decrease Rice quantity" }),
    ).toBeDisabled();
  });
});
