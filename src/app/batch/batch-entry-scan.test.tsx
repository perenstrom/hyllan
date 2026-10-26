import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BatchEntryResult } from "./actions";
import type { BatchRegisterResult, BatchScanResult } from "./scan-actions";
import type { ScannedBarcode } from "@/lib/barcode";
import type { ProductNameSuggestion } from "@/lib/product-names";

const adjustBatchItemMock =
  vi.fn<(itemId: string, delta: string) => Promise<BatchEntryResult>>();
const scanBatchBarcodeMock =
  vi.fn<
    (
      raw: string,
      symbology: string,
      direction: string,
    ) => Promise<BatchScanResult>
  >();
const registerScannedBarcodeMock =
  vi.fn<
    (
      barcode: ScannedBarcode,
      target: unknown,
      direction: string,
      reassign: boolean,
    ) => Promise<BatchRegisterResult>
  >();
const suggestScannedProductNameMock =
  vi.fn<(value: string) => Promise<ProductNameSuggestion | null>>();

vi.mock("./actions", () => ({
  adjustBatchItem: (itemId: string, delta: string) =>
    adjustBatchItemMock(itemId, delta),
  createBatchItem: vi.fn(),
}));

vi.mock("./scan-actions", () => ({
  scanBatchBarcode: (raw: string, symbology: string, direction: string) =>
    scanBatchBarcodeMock(raw, symbology, direction),
  registerScannedBarcode: (
    barcode: ScannedBarcode,
    target: unknown,
    direction: string,
    reassign: boolean,
  ) => registerScannedBarcodeMock(barcode, target, direction, reassign),
  suggestScannedProductName: (value: string) =>
    suggestScannedProductNameMock(value),
}));

// The real scanner needs a camera and the WASM decoder, neither of which
// jsdom has — this stand-in exposes the props so a test can "decode" a
// barcode and see whether the page has paused detection.
type ScannerProps = {
  paused: boolean;
  onDetected: (rawValue: string, format: string) => void;
};
let scanner: ScannerProps | null = null;
vi.mock("./barcode-scanner", () => ({
  BarcodeScanner: (props: ScannerProps) => {
    scanner = props;
    return <div data-testid="scanner" />;
  },
}));

const { BatchEntry } = await import("./batch-entry");

const PASTA = {
  id: "pasta",
  name: "Pasta",
  unit: "count" as const,
  quantity: "3",
};
const BEANS = {
  id: "beans",
  name: "Beans",
  unit: "count" as const,
  quantity: "4",
};
const EAN = "7310865004703";
const BARCODE: ScannedBarcode = { value: EAN, symbology: "ean_13" };

function renderBatch(direction: "add" | "remove") {
  return render(<BatchEntry direction={direction} items={[PASTA, BEANS]} />);
}

function openScanner() {
  fireEvent.click(screen.getByRole("button", { name: "Scan a barcode" }));
}

async function decode(rawValue = EAN, format = "ean_13") {
  await act(async () => {
    scanner?.onDetected(rawValue, format);
  });
}

function entry(
  item: typeof PASTA,
  delta: string,
  total: string,
  barcode: ScannedBarcode | undefined = BARCODE,
) {
  return {
    itemId: item.id,
    itemName: item.name,
    unit: item.unit,
    delta,
    total,
    barcode,
  };
}

function sessionLog() {
  return screen.findByRole("list", { name: "This session" });
}

function registerPanel() {
  return screen.findByRole("region", { name: "New barcode" });
}

beforeEach(() => {
  scanner = null;
  adjustBatchItemMock.mockReset();
  scanBatchBarcodeMock.mockReset();
  registerScannedBarcodeMock.mockReset();
  suggestScannedProductNameMock.mockReset().mockResolvedValue(null);
});

describe("BatchEntry scanning", () => {
  it("keeps the camera off until the scan icon in the item field is toggled", () => {
    renderBatch("add");
    expect(screen.queryByTestId("scanner")).not.toBeInTheDocument();

    openScanner();
    expect(screen.getByTestId("scanner")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close barcode scanner" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Close barcode scanner" }),
    );
    expect(screen.queryByTestId("scanner")).not.toBeInTheDocument();
  });

  it("applies a registered barcode straight away and logs it as a scan", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "applied",
      entry: entry(PASTA, "1", "4"),
    });
    renderBatch("add");
    openScanner();

    await decode();

    expect(scanBatchBarcodeMock).toHaveBeenCalledWith(EAN, "ean_13", "add");
    const logged = await within(await sessionLog()).findByRole("listitem");
    expect(logged).toHaveTextContent("Pasta");
    expect(logged).toHaveTextContent("(scan)");
    expect(logged).toHaveTextContent("+1 → 4");
  });

  it("scans in remove mode as a -1", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "applied",
      entry: entry(PASTA, "-1", "2"),
    });
    renderBatch("remove");
    openScanner();

    await decode();

    expect(scanBatchBarcodeMock).toHaveBeenCalledWith(EAN, "ean_13", "remove");
    await within(await sessionLog()).findByText("−1 → 2");
  });

  it("opens pick-or-create for an unregistered barcode in add mode and pauses scanning meanwhile", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "unregistered",
      barcode: BARCODE,
    });
    renderBatch("add");
    openScanner();

    await decode();

    const panel = await registerPanel();
    expect(panel).toHaveTextContent(EAN);
    expect(scanner?.paused).toBe(true);
  });

  it("registers the barcode to a picked item and applies +1", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "unregistered",
      barcode: BARCODE,
    });
    registerScannedBarcodeMock.mockResolvedValue({
      ok: true,
      entry: entry(BEANS, "1", "5"),
    });
    renderBatch("add");
    openScanner();
    await decode();

    const panel = await registerPanel();
    fireEvent.change(within(panel).getByLabelText("Pantry item"), {
      target: { value: "Bea" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: /Beans/ }));

    expect(registerScannedBarcodeMock).toHaveBeenCalledWith(
      BARCODE,
      { itemId: "beans" },
      "add",
      false,
    );
    await within(await sessionLog()).findByText("Beans");
    expect(
      screen.queryByRole("region", { name: "New barcode" }),
    ).not.toBeInTheDocument();
    expect(scanner?.paused).toBe(false);
  });

  it("creates a new item from the panel", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "unregistered",
      barcode: BARCODE,
    });
    registerScannedBarcodeMock.mockResolvedValue({
      ok: true,
      entry: {
        ...entry(PASTA, "1", "1"),
        itemId: "fusilli",
        itemName: "Fusilli",
      },
    });
    renderBatch("add");
    openScanner();
    await decode();

    const panel = await registerPanel();
    fireEvent.change(within(panel).getByLabelText("Pantry item"), {
      target: { value: "Fusilli" },
    });
    fireEvent.click(
      within(panel).getByRole("button", {
        name: "Add “Fusilli” as a new item",
      }),
    );

    expect(registerScannedBarcodeMock).toHaveBeenCalledWith(
      BARCODE,
      { newItemName: "Fusilli" },
      "add",
      false,
    );
    await within(await sessionLog()).findByText("Fusilli");
  });

  it("offers creating a new item as a standalone button, not one more row in the matches list", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "unregistered",
      barcode: BARCODE,
    });
    renderBatch("add");
    openScanner();
    await decode();

    const panel = await registerPanel();
    fireEvent.change(within(panel).getByLabelText("Pantry item"), {
      target: { value: "Pa" },
    });

    const create = within(panel).getByRole("button", {
      name: "Add “Pa” as a new item",
    });
    expect(create.closest("li")).toBeNull();
    expect(within(panel).getByRole("listitem")).toHaveTextContent("Pasta");
  });

  it("commits on Enter in the panel: an exact name match picks that item, anything else creates one", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "unregistered",
      barcode: BARCODE,
    });
    registerScannedBarcodeMock.mockResolvedValue({
      ok: true,
      entry: entry(PASTA, "1", "4"),
    });
    renderBatch("add");
    openScanner();
    await decode();

    const field = within(await registerPanel()).getByLabelText("Pantry item");
    fireEvent.change(field, { target: { value: "pasta" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(registerScannedBarcodeMock).toHaveBeenLastCalledWith(
      BARCODE,
      { itemId: "pasta" },
      "add",
      false,
    );

    await decode("4006381333931", "ean_13");
    const next = within(await registerPanel()).getByLabelText("Pantry item");
    fireEvent.change(next, { target: { value: "Fusilli" } });
    fireEvent.keyDown(next, { key: "Enter" });
    expect(registerScannedBarcodeMock).toHaveBeenLastCalledWith(
      BARCODE,
      { newItemName: "Fusilli" },
      "add",
      false,
    );
  });

  it("suggests a looked-up name with Open Food Facts' credit, copying it in only when tapped (ADR 0008)", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "unregistered",
      barcode: BARCODE,
    });
    suggestScannedProductNameMock.mockResolvedValue({
      name: "Fusilli",
      source: "open_food_facts",
    });
    renderBatch("add");
    openScanner();
    await decode();

    const panel = await registerPanel();
    const field = within(panel).getByLabelText("Pantry item");
    fireEvent.change(field, { target: { value: "Pas" } });
    const chip = await within(panel).findByRole("button", {
      name: "Use suggested name Fusilli",
    });
    expect(suggestScannedProductNameMock).toHaveBeenCalledWith(EAN);
    expect(panel).toHaveTextContent("via Open Food Facts");
    expect(field).toHaveValue("Pas");

    fireEvent.click(chip);
    expect(field).toHaveValue("Fusilli");
  });

  it("omits the Open Food Facts credit for a UPCitemdb suggestion, and lets the chip be dismissed", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "unregistered",
      barcode: BARCODE,
    });
    suggestScannedProductNameMock.mockResolvedValue({
      name: "Fusilli Pasta",
      source: "upcitemdb",
    });
    renderBatch("add");
    openScanner();
    await decode();

    const panel = await registerPanel();
    await within(panel).findByRole("button", {
      name: "Use suggested name Fusilli Pasta",
    });
    expect(panel).not.toHaveTextContent("Open Food Facts");

    fireEvent.click(
      within(panel).getByRole("button", { name: "Dismiss suggestion" }),
    );
    expect(
      within(panel).queryByRole("button", { name: /Use suggested name/ }),
    ).not.toBeInTheDocument();
  });

  it("closes the panel on Cancel without registering anything", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "unregistered",
      barcode: BARCODE,
    });
    renderBatch("add");
    openScanner();
    await decode();

    fireEvent.click(
      within(await registerPanel()).getByRole("button", { name: "Cancel" }),
    );

    expect(
      screen.queryByRole("region", { name: "New barcode" }),
    ).not.toBeInTheDocument();
    expect(registerScannedBarcodeMock).not.toHaveBeenCalled();
  });

  it("leaves an unregistered barcode inert in remove mode, saying why", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "unregistered",
      barcode: BARCODE,
    });
    renderBatch("remove");
    openScanner();

    await decode();

    expect(await screen.findByRole("status")).toHaveTextContent(
      `${EAN} isn't registered to an item yet`,
    );
    expect(
      screen.queryByRole("region", { name: "New barcode" }),
    ).not.toBeInTheDocument();
    expect(suggestScannedProductNameMock).not.toHaveBeenCalled();
  });

  it("corrects a scan's item: reverses it, then repoints the barcode once the reassignment is confirmed (ADR 0007)", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "applied",
      entry: entry(PASTA, "1", "4"),
    });
    adjustBatchItemMock.mockResolvedValue({
      ok: true,
      entry: entry(PASTA, "-1", "3", undefined),
    });
    registerScannedBarcodeMock
      .mockResolvedValueOnce({ ok: false, conflict: { itemName: "Pasta" } })
      .mockResolvedValueOnce({ ok: true, entry: entry(BEANS, "1", "5") });
    renderBatch("add");
    openScanner();
    await decode();

    fireEvent.click(
      await screen.findByRole("button", { name: "Wrong item? (Pasta)" }),
    );
    expect(adjustBatchItemMock).toHaveBeenCalledWith("pasta", "-1");

    const panel = await screen.findByRole("region", {
      name: "Change barcode item",
    });
    expect(suggestScannedProductNameMock).not.toHaveBeenCalled();
    fireEvent.change(within(panel).getByLabelText("Pantry item"), {
      target: { value: "Bea" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: /Beans/ }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Move this barcode to Beans?");
    expect(dialog).toHaveTextContent("registered to Pasta");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Move barcode" }),
    );

    expect(registerScannedBarcodeMock).toHaveBeenLastCalledWith(
      BARCODE,
      { itemId: "beans" },
      "add",
      true,
    );
    await within(await sessionLog()).findByText("Beans");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the panel open when a reassignment is declined", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "unregistered",
      barcode: BARCODE,
    });
    registerScannedBarcodeMock.mockResolvedValue({
      ok: false,
      conflict: { itemName: "Pasta" },
    });
    renderBatch("add");
    openScanner();
    await decode();

    const panel = await registerPanel();
    fireEvent.change(within(panel).getByLabelText("Pantry item"), {
      target: { value: "Bea" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: /Beans/ }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await registerPanel()).toBeInTheDocument();
    expect(registerScannedBarcodeMock).toHaveBeenCalledTimes(1);
  });

  it("closes the panel once the barcode is repointed, even when the removal it applied found nothing to take", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: true,
      kind: "applied",
      entry: entry(PASTA, "-1", "2"),
    });
    adjustBatchItemMock.mockResolvedValue({
      ok: true,
      entry: entry(PASTA, "1", "3", undefined),
    });
    registerScannedBarcodeMock.mockResolvedValue({
      ok: true,
      entry: entry(BEANS, "0", "0"),
    });
    renderBatch("remove");
    openScanner();
    await decode();

    fireEvent.click(
      await screen.findByRole("button", { name: "Wrong item? (Pasta)" }),
    );
    const panel = await screen.findByRole("region", {
      name: "Change barcode item",
    });
    expect(panel).toHaveTextContent("Undid the scan on Pasta.");
    fireEvent.change(within(panel).getByLabelText("Pantry item"), {
      target: { value: "Bea" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: /Beans/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nothing removed — Beans has no unassigned stock.",
    );
    expect(
      screen.queryByRole("region", { name: "Change barcode item" }),
    ).not.toBeInTheDocument();
  });

  it("shows a scan error inline", async () => {
    scanBatchBarcodeMock.mockResolvedValue({
      ok: false,
      error: "That barcode couldn't be read. Try again.",
    });
    renderBatch("add");
    openScanner();

    await decode();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That barcode couldn't be read.",
    );
  });
});
