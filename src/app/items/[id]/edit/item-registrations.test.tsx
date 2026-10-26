import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ItemBarcodeRegistration } from "@/lib/barcode-registrations";

const removeItemRegistrationMock = vi.fn();
const updateItemRegistrationQuantityPerScanMock = vi.fn();

vi.mock("./registration-actions", () => ({
  removeItemRegistration: (...args: unknown[]) =>
    removeItemRegistrationMock(...args),
  updateItemRegistrationQuantityPerScan: (...args: unknown[]) =>
    updateItemRegistrationQuantityPerScanMock(...args),
}));

const { ItemRegistrations } = await import("./item-registrations");

const named: ItemBarcodeRegistration = {
  id: "55555555-5555-5555-5555-555555555555",
  barcodeValue: "7310865004703",
  symbology: "ean_13",
  quantityPerScan: "500",
  productName: { name: "Fusilli", source: "open_food_facts" },
};

const unnamedUpcA: ItemBarcodeRegistration = {
  id: "66666666-6666-6666-6666-666666666666",
  barcodeValue: "0036000291452",
  symbology: "upc_a",
  quantityPerScan: "1",
  productName: null,
};

function rowFor(digits: string) {
  return screen.getByText(digits).closest("li")!;
}

describe("ItemRegistrations", () => {
  beforeEach(() => {
    removeItemRegistrationMock.mockReset().mockResolvedValue({ ok: true });
    updateItemRegistrationQuantityPerScanMock
      .mockReset()
      .mockResolvedValue({ ok: true });
  });

  it("points to batch scanning when the item has no barcodes", () => {
    render(<ItemRegistrations unit="g" registrations={[]} />);

    expect(
      screen.getByRole("heading", { name: "Barcodes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No barcodes yet. Scan this item in batch entry to register one.",
      ),
    ).toBeInTheDocument();
  });

  it("lists each barcode with its printed digits and per-scan amount in the item's unit", () => {
    render(<ItemRegistrations unit="g" registrations={[named, unnamedUpcA]} />);

    expect(
      within(rowFor("7310865004703")).getByText("+500 g per scan"),
    ).toBeInTheDocument();
    // UPC-A shows its 12 printed digits, not the padded canonical value.
    expect(
      within(rowFor("036000291452")).getByText("+1 g per scan"),
    ).toBeInTheDocument();
  });

  it("shows a cached product name with its Open Food Facts credit, and nothing for a barcode without one", () => {
    render(<ItemRegistrations unit="g" registrations={[named, unnamedUpcA]} />);

    const namedRow = rowFor("7310865004703");
    expect(within(namedRow).getByText("Fusilli")).toBeInTheDocument();
    expect(
      within(namedRow).getByRole("link", { name: "Open Food Facts" }),
    ).toBeInTheDocument();

    const unnamedRow = rowFor("036000291452");
    expect(within(unnamedRow).queryByText(/via/)).not.toBeInTheDocument();
  });

  it("omits the credit for a name from another source", () => {
    render(
      <ItemRegistrations
        unit="g"
        registrations={[
          { ...named, productName: { name: "Fusilli", source: "upcitemdb" } },
        ]}
      />,
    );

    expect(screen.getByText("Fusilli")).toBeInTheDocument();
    expect(screen.queryByText(/via/)).not.toBeInTheDocument();
  });

  it("saves an edited per-scan amount right away", async () => {
    render(<ItemRegistrations unit="g" registrations={[named]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Edit amount for 7310865004703" }),
    );
    const field = screen.getByLabelText("Amount per scan for 7310865004703");
    expect(field).toHaveValue(500);
    fireEvent.change(field, { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      updateItemRegistrationQuantityPerScanMock,
    ).toHaveBeenCalledExactlyOnceWith(named.id, "250");
    expect(
      await screen.findByRole("button", {
        name: "Edit amount for 7310865004703",
      }),
    ).toBeInTheDocument();
  });

  it.each(["0", "-2", ""])(
    "rejects %j with an inline error and saves nothing",
    (amount) => {
      render(<ItemRegistrations unit="g" registrations={[named]} />);

      fireEvent.click(
        screen.getByRole("button", { name: "Edit amount for 7310865004703" }),
      );
      fireEvent.change(
        screen.getByLabelText("Amount per scan for 7310865004703"),
        { target: { value: amount } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Amount must be a positive number.",
      );
      expect(updateItemRegistrationQuantityPerScanMock).not.toHaveBeenCalled();
    },
  );

  it("shows an error the server returns and stays in edit mode", async () => {
    updateItemRegistrationQuantityPerScanMock.mockResolvedValue({
      ok: false,
      error: "Barcode not found.",
    });
    render(<ItemRegistrations unit="g" registrations={[named]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Edit amount for 7310865004703" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Barcode not found.",
    );
    expect(
      screen.getByLabelText("Amount per scan for 7310865004703"),
    ).toBeInTheDocument();
  });

  it("cancelling an edit saves nothing", () => {
    render(<ItemRegistrations unit="g" registrations={[named]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Edit amount for 7310865004703" }),
    );
    fireEvent.change(
      screen.getByLabelText("Amount per scan for 7310865004703"),
      { target: { value: "250" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(updateItemRegistrationQuantityPerScanMock).not.toHaveBeenCalled();
    expect(screen.getByText("+500 g per scan")).toBeInTheDocument();
  });

  it("asks before removing a barcode, and keeps it on cancel", () => {
    render(<ItemRegistrations unit="g" registrations={[named]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove barcode 7310865004703" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", {
        name: "Remove barcode 7310865004703?",
      }),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/scanning it again will register it/i);

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(removeItemRegistrationMock).not.toHaveBeenCalled();
  });

  it("removes only that barcode once confirmed", async () => {
    render(<ItemRegistrations unit="g" registrations={[named, unnamedUpcA]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove barcode 036000291452" }),
    );
    fireEvent.submit(
      within(screen.getByRole("dialog"))
        .getByRole("button", { name: "Remove" })
        .closest("form")!,
    );

    await vi.waitFor(() =>
      expect(removeItemRegistrationMock).toHaveBeenCalledExactlyOnceWith(
        unnamedUpcA.id,
      ),
    );
  });
});
