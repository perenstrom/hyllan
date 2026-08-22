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
    expect(onSaved).toHaveBeenCalledExactlyOnceWith("5", "blur");
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

  it("shows large +/- stepper buttons", () => {
    renderField();

    expect(
      screen.getByRole("button", { name: /decrease/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /increase/i }),
    ).toBeInTheDocument();
  });

  it("steps a weight unit (kg) by 0.5 per tap and saves immediately", async () => {
    setStockTakeQuantityMock.mockResolvedValue({ ok: true, quantity: "2.5" });
    const { onSaved } = renderField({ unit: "kg", savedQuantity: "2" });

    fireEvent.click(screen.getByRole("button", { name: /increase/i }));

    expect(screen.getByRole("spinbutton")).toHaveValue(2.5);
    await vi.waitFor(() => {
      expect(setStockTakeQuantityMock).toHaveBeenCalledExactlyOnceWith(
        "item-1",
        "location-1",
        "2.5",
      );
    });
    expect(onSaved).toHaveBeenCalledExactlyOnceWith("2.5", "stepper");
  });

  it("steps a volume unit (l) by 0.1 per tap", () => {
    setStockTakeQuantityMock.mockResolvedValue({ ok: true, quantity: "1.1" });
    renderField({ unit: "l", savedQuantity: "1" });

    fireEvent.click(screen.getByRole("button", { name: /increase/i }));

    expect(screen.getByRole("spinbutton")).toHaveValue(1.1);
  });

  it("steps a gram unit by 50 per tap", () => {
    setStockTakeQuantityMock.mockResolvedValue({ ok: true, quantity: "150" });
    renderField({ unit: "g", savedQuantity: "100" });

    fireEvent.click(screen.getByRole("button", { name: /increase/i }));

    expect(screen.getByRole("spinbutton")).toHaveValue(150);
  });

  it("steps a ml unit by 50 per tap", () => {
    setStockTakeQuantityMock.mockResolvedValue({ ok: true, quantity: "250" });
    renderField({ unit: "ml", savedQuantity: "200" });

    fireEvent.click(screen.getByRole("button", { name: /increase/i }));

    expect(screen.getByRole("spinbutton")).toHaveValue(250);
  });

  it.each(["count", "box", "bag", "pack"] as const)(
    "steps a %s unit by whole numbers",
    (unit) => {
      setStockTakeQuantityMock.mockResolvedValue({ ok: true, quantity: "4" });
      renderField({ unit, savedQuantity: "3" });

      fireEvent.click(screen.getByRole("button", { name: /increase/i }));

      expect(screen.getByRole("spinbutton")).toHaveValue(4);
    },
  );

  it("disables the decrease button and never steps below zero", () => {
    renderField({ unit: "kg", savedQuantity: "0" });

    const decreaseButton = screen.getByRole("button", { name: /decrease/i });
    expect(decreaseButton).toBeDisabled();

    fireEvent.click(decreaseButton);

    expect(screen.getByRole("spinbutton")).toHaveValue(0);
    expect(setStockTakeQuantityMock).not.toHaveBeenCalled();
  });

  it("steps from the last saved amount, not zero, when the field holds invalid mid-edit text", () => {
    setStockTakeQuantityMock.mockResolvedValue({ ok: true, quantity: "2.5" });
    renderField({ unit: "kg", savedQuantity: "2" });

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "2." } });
    fireEvent.click(screen.getByRole("button", { name: /increase/i }));

    expect(screen.getByRole("spinbutton")).toHaveValue(2.5);
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
