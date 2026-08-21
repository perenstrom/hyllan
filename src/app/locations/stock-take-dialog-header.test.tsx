import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StockTakeDialogHeader } from "./stock-take-dialog-header";

describe("StockTakeDialogHeader", () => {
  it("shows the given title", () => {
    render(
      <StockTakeDialogHeader title="Stock take: Pantry" onClose={vi.fn()} />,
    );

    expect(
      screen.getByRole("heading", { name: "Stock take: Pantry" }),
    ).toBeInTheDocument();
  });

  it("calls onClose when Close is clicked", () => {
    const onClose = vi.fn();
    render(
      <StockTakeDialogHeader title="Stock take: Pantry" onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close stock take" }));

    expect(onClose).toHaveBeenCalled();
  });
});
