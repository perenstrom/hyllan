import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BatchEntryResult } from "./actions";

const adjustBatchItemMock =
  vi.fn<(itemId: string, delta: string) => Promise<BatchEntryResult>>();
const createBatchItemMock =
  vi.fn<(name: string, quantity: string) => Promise<BatchEntryResult>>();

vi.mock("./actions", () => ({
  adjustBatchItem: (itemId: string, delta: string) =>
    adjustBatchItemMock(itemId, delta),
  createBatchItem: (name: string, quantity: string) =>
    createBatchItemMock(name, quantity),
}));

const { BatchEntry } = await import("./batch-entry");

const RICE = { id: "rice", name: "Rice", unit: "kg" as const, quantity: "3" };
const BEANS = {
  id: "beans",
  name: "Beans",
  unit: "count" as const,
  quantity: "4",
};

function renderBatch(direction: "add" | "remove") {
  return render(<BatchEntry direction={direction} items={[RICE, BEANS]} />);
}

function itemField() {
  return screen.getByLabelText("Item");
}

function quantityField() {
  return screen.getByLabelText("Quantity");
}

function typeItem(text: string) {
  fireEvent.focus(itemField());
  fireEvent.change(itemField(), { target: { value: text } });
}

function selectItem(name: string) {
  typeItem(name.slice(0, 2));
  fireEvent.mouseDown(screen.getByRole("button", { name: new RegExp(name) }));
}

function sessionLog() {
  return screen.findByRole("list", { name: "This session" });
}

function ok(
  itemId: string,
  itemName: string,
  unit: "kg" | "count",
  delta: string,
  total: string,
): BatchEntryResult {
  return { ok: true, entry: { itemId, itemName, unit, delta, total } };
}

beforeEach(() => {
  adjustBatchItemMock.mockReset();
  createBatchItemMock.mockReset();
});

describe("BatchEntry", () => {
  it("links Done back to the pantry list", () => {
    renderBatch("add");

    expect(screen.getByRole("link", { name: "Done" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("adds the chosen quantity of a picked item and logs the delta and new total", async () => {
    adjustBatchItemMock.mockResolvedValue(ok("rice", "Rice", "kg", "2", "5"));
    renderBatch("add");

    selectItem("Rice");
    fireEvent.change(quantityField(), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(adjustBatchItemMock).toHaveBeenCalledWith("rice", "2");
    const entry = await within(await sessionLog()).findByRole("listitem");
    expect(entry).toHaveTextContent("Rice");
    expect(entry).toHaveTextContent("+2 kg → 5 kg");
  });

  it("commits on Enter in the item field, matching a typed name case-insensitively", async () => {
    adjustBatchItemMock.mockResolvedValue(
      ok("beans", "Beans", "count", "1", "5"),
    );
    renderBatch("add");

    typeItem("beans");
    fireEvent.keyDown(itemField(), { key: "Enter" });

    expect(adjustBatchItemMock).toHaveBeenCalledWith("beans", "1");
    await within(await sessionLog()).findByText("+1 → 5");
  });

  it("commits on Enter in the quantity field and resets the row", async () => {
    adjustBatchItemMock.mockResolvedValue(ok("rice", "Rice", "kg", "3", "6"));
    renderBatch("add");

    selectItem("Rice");
    fireEvent.change(quantityField(), { target: { value: "3" } });
    fireEvent.keyDown(quantityField(), { key: "Enter" });

    await within(await sessionLog()).findByText("+3 kg → 6 kg");
    expect(itemField()).toHaveValue("");
    expect(quantityField()).toHaveValue(1);
  });

  it("steps the quantity with +/- and never below zero", () => {
    renderBatch("add");

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(quantityField()).toHaveValue(2);

    fireEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(quantityField()).toHaveValue(0);
    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).toBeDisabled();
  });

  it("offers to create an unknown name in add mode, and creates it on commit", async () => {
    createBatchItemMock.mockResolvedValue(
      ok("lentils", "Lentils", "count", "1", "1"),
    );
    renderBatch("add");

    typeItem("Lentils");
    fireEvent.mouseDown(
      screen.getByRole("button", { name: "Add “Lentils” as a new item" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(createBatchItemMock).toHaveBeenCalledWith("Lentils", "1");
    expect(adjustBatchItemMock).not.toHaveBeenCalled();
    await within(await sessionLog()).findByText("Lentils");
  });

  it("removes the chosen quantity of a picked item in remove mode", async () => {
    adjustBatchItemMock.mockResolvedValue(ok("rice", "Rice", "kg", "-2", "1"));
    renderBatch("remove");

    selectItem("Rice");
    fireEvent.change(quantityField(), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(adjustBatchItemMock).toHaveBeenCalledWith("rice", "-2");
    await within(await sessionLog()).findByText("−2 kg → 1 kg");
  });

  it("never creates in remove mode — an unknown name shows an error and doesn't submit", () => {
    renderBatch("remove");

    typeItem("Lentils");
    expect(
      screen.queryByRole("button", { name: /as a new item/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No item matches “Lentils”.",
    );
    expect(adjustBatchItemMock).not.toHaveBeenCalled();
    expect(createBatchItemMock).not.toHaveBeenCalled();
  });

  it("shows a server-side error inline and keeps the row for correction", async () => {
    createBatchItemMock.mockResolvedValue({
      ok: false,
      error: "Lentils is already tracked in kg.",
    });
    renderBatch("add");

    typeItem("Lentils");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Lentils is already tracked in kg.",
    );
    expect(itemField()).toHaveValue("Lentils");
  });

  it("lists the session newest-first", async () => {
    adjustBatchItemMock
      .mockResolvedValueOnce(ok("rice", "Rice", "kg", "1", "4"))
      .mockResolvedValueOnce(ok("beans", "Beans", "count", "1", "5"));
    renderBatch("add");

    selectItem("Rice");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await within(await sessionLog()).findByText("Rice");
    selectItem("Beans");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await within(await sessionLog()).findByText("Beans");

    const entries = within(await sessionLog()).getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent("Beans");
    expect(entries[1]).toHaveTextContent("Rice");
  });

  it("reverses an entry by applying the inverse of its applied delta, logging a paired reversal and striking the original", async () => {
    adjustBatchItemMock
      .mockResolvedValueOnce(ok("rice", "Rice", "kg", "-2", "1"))
      .mockResolvedValueOnce(ok("rice", "Rice", "kg", "2", "3"));
    renderBatch("remove");

    selectItem("Rice");
    fireEvent.change(quantityField(), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Reverse Rice" }),
    );

    expect(adjustBatchItemMock).toHaveBeenLastCalledWith("rice", "2");
    await within(await sessionLog()).findByText("(reversal)");
    const [reversal, original] = within(await sessionLog()).getAllByRole(
      "listitem",
    );
    expect(reversal).toHaveTextContent("+2 kg → 3 kg");
    expect(original.querySelector("del")).toHaveTextContent("Rice");
    expect(
      screen.queryByRole("button", { name: "Reverse Rice" }),
    ).not.toBeInTheDocument();
  });
});
