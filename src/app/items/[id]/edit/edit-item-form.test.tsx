import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const editItemMock = vi.fn();

vi.mock("../../actions", () => ({
  editItem: (...args: unknown[]) => editItemMock(...args),
}));

// item-form.tsx renders LocationPickerCombobox, which imports the
// createLocation server action — that transitively pulls in "@/db/client"
// (DATABASE_URL), so it needs the same treatment as "../../actions" above.
vi.mock("@/app/locations/actions", () => ({
  createLocation: vi.fn(),
}));

const { EditItemForm } = await import("./edit-item-form");

const item = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Rice",
  quantity: "2",
  unit: "kg" as const,
  minimumQuantity: null as string | null,
  locationId: null as string | null,
};

describe("EditItemForm", () => {
  beforeEach(() => {
    editItemMock.mockReset();
  });

  it("prefills name, quantity, and unit from the item", () => {
    render(<EditItemForm item={item} locations={[]} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Rice");
    expect(screen.getByLabelText("Quantity")).toHaveValue(2);
    expect(screen.getByLabelText("Unit")).toHaveValue("kg");
  });

  it("leaves the minimum quantity field blank when the item has none set", () => {
    render(<EditItemForm item={item} locations={[]} />);

    expect(
      screen.getByLabelText<HTMLInputElement>("Minimum quantity (optional)")
        .value,
    ).toBe("");
  });

  it("prefills the minimum quantity field when the item has one set", () => {
    render(
      <EditItemForm item={{ ...item, minimumQuantity: "1" }} locations={[]} />,
    );

    expect(screen.getByLabelText("Minimum quantity (optional)")).toHaveValue(1);
  });

  it("submits through editItem bound to the item's id", () => {
    render(<EditItemForm item={item} locations={[]} />);

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

    render(<EditItemForm item={item} locations={[]} />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Save changes" }).closest("form")!,
    );

    expect(
      await screen.findByText("You already have an item with that name."),
    ).toBeInTheDocument();
  });

  it("prefills the location field from the item, defaulting to Unassigned", () => {
    render(<EditItemForm item={item} locations={[]} />);

    expect(screen.getByLabelText("Location (optional)")).toHaveValue(
      "Unassigned",
    );
  });

  it("prefills the location field with the item's assigned location name", () => {
    const pantry = {
      id: "33333333-3333-3333-3333-333333333333",
      name: "Pantry",
    };
    render(
      <EditItemForm
        item={{ ...item, locationId: pantry.id }}
        locations={[pantry]}
      />,
    );

    expect(screen.getByLabelText("Location (optional)")).toHaveValue("Pantry");
  });

  it("carries the item's current location as originalLocationId, so a later location change can be told apart from a same-bucket edit", () => {
    const pantry = {
      id: "33333333-3333-3333-3333-333333333333",
      name: "Pantry",
    };
    const { container } = render(
      <EditItemForm
        item={{ ...item, locationId: pantry.id }}
        locations={[pantry]}
      />,
    );

    const hidden = container.querySelector(
      'input[type="hidden"][name="originalLocationId"]',
    );
    expect(hidden).toHaveValue(pantry.id);
  });

  it("links back to the pantry without saving anything", () => {
    render(<EditItemForm item={item} locations={[]} />);

    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
