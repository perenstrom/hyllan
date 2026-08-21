import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setStockTakeQuantityMock = vi.fn();

vi.mock("./actions", () => ({
  setStockTakeQuantity: (...args: unknown[]) =>
    setStockTakeQuantityMock(...args),
}));

const { StockTakeLauncher } = await import("./stock-take-launcher");

const PANTRY = { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "Pantry" };

describe("StockTakeLauncher", () => {
  beforeEach(() => {
    setStockTakeQuantityMock.mockReset();
  });

  it("shows the start screen naming the location and both flow choices", () => {
    render(
      <StockTakeLauncher location={PANTRY} items={[]} onClose={vi.fn()} />,
    );

    expect(screen.getByText("Start a stock take")).toBeInTheDocument();
    expect(screen.getByText("Pantry")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Go through everything recorded here",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Look up one item" }),
    ).toBeInTheDocument();
  });

  it("switches to the stock-to-shelf walkthrough", () => {
    render(
      <StockTakeLauncher location={PANTRY} items={[]} onClose={vi.fn()} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Go through everything recorded here",
      }),
    );

    expect(screen.getByText("Stock take: Pantry")).toBeInTheDocument();
  });

  it("switches to the shelf-to-stock lookup", () => {
    render(
      <StockTakeLauncher location={PANTRY} items={[]} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Look up one item" }));

    expect(screen.getByText("Look up an item: Pantry")).toBeInTheDocument();
  });

  it("closes via Cancel on the start screen", () => {
    const onClose = vi.fn();
    render(
      <StockTakeLauncher location={PANTRY} items={[]} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });
});
