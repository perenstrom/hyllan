import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignedInHome } from "./signed-in-home";

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
});
