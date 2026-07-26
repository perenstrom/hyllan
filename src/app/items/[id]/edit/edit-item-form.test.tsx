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
