import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const editItemMock = vi.fn();

vi.mock("../../actions", () => ({
  editItem: (...args: unknown[]) => editItemMock(...args),
}));

const { EditItemForm } = await import("./edit-item-form");

const item = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Rice",
  quantity: "2",
  unit: "kg" as const,
  minimumQuantity: null as string | null,
};

describe("EditItemForm", () => {
  beforeEach(() => {
    editItemMock.mockReset();
  });

  it("prefills name, quantity, and unit from the item", () => {
    render(<EditItemForm item={item} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Rice");
    expect(screen.getByLabelText("Quantity")).toHaveValue(2);
    expect(screen.getByLabelText("Unit")).toHaveValue("kg");
  });

  it("leaves the minimum quantity field blank when the item has none set", () => {
    render(<EditItemForm item={item} />);

    expect(
      screen.getByLabelText<HTMLInputElement>("Minimum quantity (optional)")
        .value,
    ).toBe("");
  });

  it("prefills the minimum quantity field when the item has one set", () => {
    render(<EditItemForm item={{ ...item, minimumQuantity: "1" }} />);

    expect(screen.getByLabelText("Minimum quantity (optional)")).toHaveValue(1);
  });

  it("submits through editItem bound to the item's id", () => {
    render(<EditItemForm item={item} />);

    fireEvent.submit(
      screen.getByRole("button", { name: "Save changes" }).closest("form")!,
    );

    expect(editItemMock).toHaveBeenCalledWith(
      item.id,
      undefined,
      expect.any(FormData),
    );
  });

  it("shows the server-side validation error returned by the action", async () => {
    editItemMock.mockResolvedValue({
      error: "You already have an item with that name.",
    });

    render(<EditItemForm item={item} />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Save changes" }).closest("form")!,
    );

    expect(
      await screen.findByText("You already have an item with that name."),
    ).toBeInTheDocument();
  });

  it("links back to the pantry without saving anything", () => {
    render(<EditItemForm item={item} />);

    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
