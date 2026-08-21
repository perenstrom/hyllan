import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PantryItemBucket } from "@/lib/location";
import type { PantryItemWithLocations } from "@/lib/pantry-items";

const setStockTakeQuantityMock = vi.fn();

vi.mock("./actions", () => ({
  setStockTakeQuantity: (...args: unknown[]) =>
    setStockTakeQuantityMock(...args),
}));

const { ShelfToStockDialog } = await import("./shelf-to-stock-dialog");

const PANTRY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function itemRow(
  overrides: Partial<
    Omit<PantryItemWithLocations, "buckets"> & { buckets: PantryItemBucket[] }
  > = {},
): PantryItemWithLocations {
  const quantity = overrides.quantity ?? "2";
  const buckets = overrides.buckets ?? [
    { locationId: PANTRY_ID, locationName: "Pantry", quantity },
  ];
  return {
    id: "item-1",
    householdId: "household-1",
    name: "Rice",
    unit: "kg",
    minimumQuantity: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    quantity,
    buckets,
  };
}

const PANTRY = { id: PANTRY_ID, name: "Pantry" };

function renderDialog(
  overrides: Partial<Parameters<typeof ShelfToStockDialog>[0]> = {},
) {
  const onClose = vi.fn();
  const utils = render(
    <ShelfToStockDialog
      location={PANTRY}
      items={[]}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { ...utils, onClose };
}

function pickerField() {
  return screen.getByPlaceholderText("Search for an item");
}

function selectItem(name: string) {
  fireEvent.focus(pickerField());
  fireEvent.mouseDown(screen.getByRole("button", { name }));
}

describe("ShelfToStockDialog", () => {
  beforeEach(() => {
    setStockTakeQuantityMock.mockReset();
  });

  it("offers every pantry item, unfiltered to this location", () => {
    const rice = itemRow({
      id: "rice",
      name: "Rice",
      buckets: [
        { locationId: PANTRY_ID, locationName: "Pantry", quantity: "2" },
      ],
    });
    const flour = itemRow({
      id: "flour",
      name: "Flour",
      buckets: [],
    });
    renderDialog({ items: [rice, flour] });

    fireEvent.focus(pickerField());

    expect(screen.getByRole("button", { name: "Rice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Flour" })).toBeInTheDocument();
  });

  it("shows the item's current quantity at this location once picked", () => {
    const rice = itemRow({
      id: "rice",
      name: "Rice",
      buckets: [
        { locationId: PANTRY_ID, locationName: "Pantry", quantity: "4" },
      ],
    });
    renderDialog({ items: [rice] });

    selectItem("Rice");

    expect(screen.getByRole("spinbutton")).toHaveValue(4);
  });

  it("shows zero for an item with no bucket at this location yet", () => {
    const flour = itemRow({ id: "flour", name: "Flour", buckets: [] });
    renderDialog({ items: [flour] });

    selectItem("Flour");

    expect(screen.getByRole("spinbutton")).toHaveValue(0);
  });

  it("saves on blur and resets the picker to no selection", async () => {
    setStockTakeQuantityMock.mockResolvedValue({ ok: true, quantity: "6" });
    const flour = itemRow({ id: "flour", name: "Flour", buckets: [] });
    renderDialog({ items: [flour] });

    selectItem("Flour");
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "6" } });
    fireEvent.blur(input);

    await vi.waitFor(() => {
      expect(setStockTakeQuantityMock).toHaveBeenCalledExactlyOnceWith(
        "flour",
        PANTRY_ID,
        "6",
      );
    });
    await vi.waitFor(() => {
      expect(pickerField()).toHaveValue("");
    });
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("does not save when the field is left unchanged", () => {
    const rice = itemRow({
      id: "rice",
      name: "Rice",
      buckets: [
        { locationId: PANTRY_ID, locationName: "Pantry", quantity: "2" },
      ],
    });
    renderDialog({ items: [rice] });

    selectItem("Rice");
    fireEvent.blur(screen.getByRole("spinbutton"));

    expect(setStockTakeQuantityMock).not.toHaveBeenCalled();
  });

  it("shows an error and does not save on an invalid value", () => {
    const rice = itemRow({
      id: "rice",
      name: "Rice",
      buckets: [
        { locationId: PANTRY_ID, locationName: "Pantry", quantity: "2" },
      ],
    });
    renderDialog({ items: [rice] });

    selectItem("Rice");
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.blur(input);

    expect(
      screen.getByText("Quantity must be zero or a positive number."),
    ).toBeInTheDocument();
    expect(setStockTakeQuantityMock).not.toHaveBeenCalled();
  });

  it("does not carry a stale error over when a different item is picked", () => {
    const rice = itemRow({
      id: "rice",
      name: "Rice",
      buckets: [
        { locationId: PANTRY_ID, locationName: "Pantry", quantity: "2" },
      ],
    });
    const flour = itemRow({ id: "flour", name: "Flour", buckets: [] });
    renderDialog({ items: [rice, flour] });

    selectItem("Rice");
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.blur(input);
    expect(
      screen.getByText("Quantity must be zero or a positive number."),
    ).toBeInTheDocument();

    fireEvent.focus(pickerField());
    fireEvent.change(pickerField(), { target: { value: "" } });
    selectItem("Flour");

    expect(
      screen.queryByText("Quantity must be zero or a positive number."),
    ).not.toBeInTheDocument();
    expect(setStockTakeQuantityMock).not.toHaveBeenCalled();
  });

  it("closes when Close is clicked", () => {
    const { onClose } = renderDialog({ items: [] });

    fireEvent.click(screen.getByRole("button", { name: "Close stock take" }));

    expect(onClose).toHaveBeenCalled();
  });
});
