import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PantryItemBucket } from "@/lib/location";
import type { PantryItemWithLocations } from "@/lib/pantry-items";

const setStockTakeQuantityMock = vi.fn();

vi.mock("./actions", () => ({
  setStockTakeQuantity: (...args: unknown[]) =>
    setStockTakeQuantityMock(...args),
}));

const { StockToShelfDialog } = await import("./stock-to-shelf-dialog");

const PANTRY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const GARAGE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

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
  overrides: Partial<Parameters<typeof StockToShelfDialog>[0]> = {},
) {
  const onClose = vi.fn();
  const utils = render(
    <StockToShelfDialog
      location={PANTRY}
      items={[]}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { ...utils, onClose };
}

describe("StockToShelfDialog", () => {
  beforeEach(() => {
    setStockTakeQuantityMock.mockReset();
  });

  it("shows an empty message when nothing is recorded at the location", () => {
    renderDialog({ items: [] });

    expect(
      screen.getByText("Nothing recorded at Pantry yet."),
    ).toBeInTheDocument();
  });

  it("lists only items with a positive quantity at this location, alphabetically", () => {
    const rice = itemRow({
      id: "rice",
      name: "Rice",
      buckets: [
        { locationId: PANTRY_ID, locationName: "Pantry", quantity: "2" },
      ],
    });
    const beans = itemRow({
      id: "beans",
      name: "Beans",
      buckets: [
        { locationId: PANTRY_ID, locationName: "Pantry", quantity: "1" },
      ],
    });
    const zeroed = itemRow({
      id: "zeroed",
      name: "Oats",
      buckets: [
        { locationId: PANTRY_ID, locationName: "Pantry", quantity: "0" },
      ],
    });
    const elsewhere = itemRow({
      id: "elsewhere",
      name: "Flour",
      buckets: [
        { locationId: GARAGE_ID, locationName: "Garage", quantity: "3" },
      ],
    });

    renderDialog({ items: [rice, beans, zeroed, elsewhere] });

    expect(screen.getByText("Item 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Beans")).toBeInTheDocument();
  });

  it("pre-fills the field with the item's current recorded quantity", () => {
    const rice = itemRow({ quantity: "3" });

    renderDialog({ items: [rice] });

    expect(screen.getByRole("spinbutton")).toHaveValue(3);
  });

  it("saves on blur when the value changes", async () => {
    setStockTakeQuantityMock.mockResolvedValue({ ok: true, quantity: "5" });
    const rice = itemRow({ id: "rice", quantity: "2" });
    renderDialog({ items: [rice] });

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);

    await vi.waitFor(() => {
      expect(setStockTakeQuantityMock).toHaveBeenCalledExactlyOnceWith(
        "rice",
        PANTRY_ID,
        "5",
      );
    });
  });

  it("does not save when the field is left unchanged", () => {
    const rice = itemRow({ quantity: "2" });
    renderDialog({ items: [rice] });

    const input = screen.getByRole("spinbutton");
    fireEvent.blur(input);

    expect(setStockTakeQuantityMock).not.toHaveBeenCalled();
  });

  it("shows an error and does not save on an invalid value", () => {
    const rice = itemRow({ quantity: "2" });
    renderDialog({ items: [rice] });

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.blur(input);

    expect(
      screen.getByText("Quantity must be zero or a positive number."),
    ).toBeInTheDocument();
    expect(setStockTakeQuantityMock).not.toHaveBeenCalled();
  });

  it("does not carry a stale error over to the next item on Next", () => {
    const rice = itemRow({ id: "rice", name: "Rice", quantity: "2" });
    const beans = itemRow({ id: "beans", name: "Beans", quantity: "1" });
    renderDialog({ items: [rice, beans] });

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.blur(input);
    expect(
      screen.getByText("Quantity must be zero or a positive number."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.queryByText("Quantity must be zero or a positive number."),
    ).not.toBeInTheDocument();
    expect(setStockTakeQuantityMock).not.toHaveBeenCalled();
  });

  it("navigates between items with Next/Previous and shows progress", () => {
    const rice = itemRow({ id: "rice", name: "Rice", quantity: "2" });
    const beans = itemRow({ id: "beans", name: "Beans", quantity: "1" });
    renderDialog({ items: [rice, beans] });

    expect(screen.getByText("Item 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Item 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Item 1 of 2")).toBeInTheDocument();
  });

  it("ends the pass when Finish is clicked on the last item", () => {
    const rice = itemRow({ quantity: "2" });
    const { onClose } = renderDialog({ items: [rice] });

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("ends the pass when Close is clicked", () => {
    const rice = itemRow({ quantity: "2" });
    const { onClose } = renderDialog({ items: [rice] });

    fireEvent.click(screen.getByRole("button", { name: "Close stock take" }));

    expect(onClose).toHaveBeenCalled();
  });
});
