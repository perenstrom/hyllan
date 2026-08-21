import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addItemMock = vi.fn();

vi.mock("../actions", () => ({
  addItem: (...args: unknown[]) => addItemMock(...args),
}));

// item-form.tsx renders LocationPickerCombobox, which imports the
// createLocation server action — that transitively pulls in "@/db/client"
// (DATABASE_URL), so it needs the same treatment as "../actions" above.
vi.mock("@/app/locations/actions", () => ({
  createLocation: vi.fn(),
}));

const { AddItemForm } = await import("./add-item-form");

describe("AddItemForm", () => {
  beforeEach(() => {
    addItemMock.mockReset();
  });

  it("renders name, quantity, and unit fields, defaulting unit to count", () => {
    render(<AddItemForm locations={[]} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toHaveValue(1);
    expect(screen.getByLabelText("Unit")).toHaveValue("count");
  });

  it("leaves the optional minimum quantity field blank by default", () => {
    render(<AddItemForm locations={[]} />);

    expect(
      screen.getByLabelText<HTMLInputElement>("Minimum quantity (optional)")
        .value,
    ).toBe("");
  });

  it("offers every unit in the fixed set", () => {
    render(<AddItemForm locations={[]} />);

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

    render(<AddItemForm locations={[]} />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Add item" }).closest("form")!,
    );

    expect(
      await screen.findByText("Quantity must be zero or a positive number."),
    ).toBeInTheDocument();
  });

  it("links back to the pantry without adding anything", () => {
    render(<AddItemForm locations={[]} />);

    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("defaults the location field to Unassigned", () => {
    render(<AddItemForm locations={[]} />);

    expect(screen.getByLabelText("Location (optional)")).toHaveValue(
      "Unassigned",
    );
  });

  it("does not submit an originalLocationId — an add has no bucket to move from", () => {
    const { container } = render(<AddItemForm locations={[]} />);

    expect(
      container.querySelector('input[name="originalLocationId"]'),
    ).not.toBeInTheDocument();
  });

  it("offers the household's existing locations in the picker", async () => {
    render(<AddItemForm locations={[{ id: "loc-1", name: "Pantry" }]} />);

    const field = screen.getByLabelText("Location (optional)");
    fireEvent.focus(field);
    // Focusing selects the current "Unassigned" text (so typing replaces
    // it) — clear it here the way a real keystroke would, so the filter
    // isn't still narrowed to "unassigned".
    fireEvent.change(field, { target: { value: "" } });

    expect(screen.getByRole("button", { name: "Pantry" })).toBeInTheDocument();
  });
});
