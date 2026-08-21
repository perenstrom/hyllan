import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setStockTakeQuantityMock = vi.fn();

vi.mock("./actions", () => ({
  setStockTakeQuantity: (...args: unknown[]) =>
    setStockTakeQuantityMock(...args),
}));

const { StockTakeQuantityField } = await import("./stock-take-quantity-field");

function renderField(
  overrides: Partial<Parameters<typeof StockTakeQuantityField>[0]> = {},
) {
  const onSaved = vi.fn();
  const utils = render(
    <StockTakeQuantityField
      itemId="item-1"
      locationId="location-1"
      unit="kg"
      savedQuantity="2"
      onSaved={onSaved}
      {...overrides}
    />,
  );
  return { ...utils, onSaved };
}

describe("StockTakeQuantityField", () => {
  beforeEach(() => {
    setStockTakeQuantityMock.mockReset();
  });

  it("pre-fills with the saved quantity and shows the unit", () => {
    renderField({ savedQuantity: "3", unit: "kg" });

    expect(screen.getByRole("spinbutton")).toHaveValue(3);
    expect(screen.getByText("kg")).toBeInTheDocument();
  });

  it("saves on blur when the value changes and reports it via onSaved", async () => {
    setStockTakeQuantityMock.mockResolvedValue({ ok: true, quantity: "5" });
    const { onSaved } = renderField({
      itemId: "item-1",
      locationId: "location-1",
      savedQuantity: "2",
    });

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);

    await vi.waitFor(() => {
      expect(setStockTakeQuantityMock).toHaveBeenCalledExactlyOnceWith(
        "item-1",
        "location-1",
        "5",
      );
    });
    expect(onSaved).toHaveBeenCalledExactlyOnceWith("5");
  });

  it("does not save when the field is left unchanged", () => {
    const { onSaved } = renderField({ savedQuantity: "2" });

    fireEvent.blur(screen.getByRole("spinbutton"));

    expect(setStockTakeQuantityMock).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows an error and does not save on an invalid value", () => {
    const { onSaved } = renderField({ savedQuantity: "2" });

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.blur(input);

    expect(
      screen.getByText("Quantity must be zero or a positive number."),
    ).toBeInTheDocument();
    expect(setStockTakeQuantityMock).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("surfaces a server-side error and does not call onSaved", async () => {
    setStockTakeQuantityMock.mockResolvedValue({
      ok: false,
      error: "Item not found.",
    });
    const { onSaved } = renderField({ savedQuantity: "2" });

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);

    expect(await screen.findByText("Item not found.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("starts with no error for a fresh instance, even after a previous one showed one", () => {
    const { unmount } = renderField({ savedQuantity: "2" });
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.blur(input);
    expect(
      screen.getByText("Quantity must be zero or a positive number."),
    ).toBeInTheDocument();
    unmount();

    // A parent remounts this component (via `key`) when the item/selection
    // changes — simulated here by unmounting and rendering a fresh instance,
    // the same lifecycle a `key` change produces.
    renderField({ savedQuantity: "1" });

    expect(
      screen.queryByText("Quantity must be zero or a positive number."),
    ).not.toBeInTheDocument();
  });
});
