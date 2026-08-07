import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addItemMock = vi.fn();

vi.mock("../actions", () => ({
  addItem: (...args: unknown[]) => addItemMock(...args),
}));

const { AddItemForm } = await import("./add-item-form");

describe("AddItemForm", () => {
  beforeEach(() => {
    addItemMock.mockReset();
  });

  it("renders name, quantity, and unit fields, defaulting unit to count", () => {
    render(<AddItemForm />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toHaveValue(1);
    expect(screen.getByLabelText("Unit")).toHaveValue("count");
  });

  it("leaves the optional minimum quantity field blank by default", () => {
    render(<AddItemForm />);

    expect(
      screen.getByLabelText<HTMLInputElement>("Minimum quantity (optional)")
        .value,
    ).toBe("");
  });

  it("offers every unit in the fixed set", () => {
    render(<AddItemForm />);

    const options = screen.getByLabelText("Unit").querySelectorAll("option");
    expect(Array.from(options).map((option) => option.textContent)).toEqual([
      "count",
      "g",
      "kg",
      "ml",
      "l",
      "box",
      "bag",
      "pack",
    ]);
  });

  it("shows the server-side validation error returned by the action", async () => {
    addItemMock.mockResolvedValue({
      error: "Quantity must be zero or a positive number.",
    });

    render(<AddItemForm />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Add item" }).closest("form")!,
    );

    expect(
      await screen.findByText("Quantity must be zero or a positive number."),
    ).toBeInTheDocument();
  });

  it("links back to the pantry without adding anything", () => {
    render(<AddItemForm />);

    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
