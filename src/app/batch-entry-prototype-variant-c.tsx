"use client";

import { useState } from "react";

import { BatchScanCamera } from "./batch-entry-prototype-camera";
import { BatchItemEntryRow } from "./batch-entry-prototype-item-field";
import { BarcodeRegisterPanel } from "./batch-entry-prototype-register-panel";
import {
  DEMO_KNOWN_BARCODE,
  DEMO_UNKNOWN_BARCODE,
  useBarcodeRegistry,
  useBatchSession,
  type BatchDirection,
  type PrototypeItem,
} from "./batch-entry-prototype-session";

// Variant C — "Inline panel, no dialog": batch entry isn't a modal session
// at all — it's an expanding panel between the header and the real pantry
// table, the same way the Status/Location filters already sit inline
// rather than behind a dialog. Scanning opens the camera as a small
// anchored popover next to the scan button, not a full-screen takeover.
// There's no separate "applied this session" feed — touched items surface
// by rising to the top of the list below, tinted, which is the prototype's
// simplified stand-in for "the real table doubles as the feed" (the real
// ItemGroupedTable takes sort/filter state this prototype doesn't
// reproduce — this is a compact proxy of the same row styling, close
// enough to react to for the layout question, not a working reimplementation).
// Compare with Variant A/B (both dialog-based).

type Props = {
  items: PrototypeItem[];
};

export function BatchEntryVariantC({ items: initialItems }: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const { items, entries, applyEntry } = useBatchSession(initialItems);
  const { register, resolve } = useBarcodeRegistry(initialItems[0]?.id);
  const [direction, setDirection] = useState<BatchDirection>("add");
  const [scanOpen, setScanOpen] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);

  const touchedIds = [...new Set(entries.map((entry) => entry.itemId))];
  const touchedFirst = [
    ...touchedIds
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is PrototypeItem => item !== undefined),
    ...items.filter((item) => !touchedIds.includes(item.id)),
  ];

  function handleScan(kind: "known" | "unknown") {
    const barcode =
      kind === "known" ? DEMO_KNOWN_BARCODE : DEMO_UNKNOWN_BARCODE;
    const itemId = resolve(barcode);
    if (itemId) {
      const item = items.find((candidate) => candidate.id === itemId);
      if (item) {
        applyEntry({
          itemId: item.id,
          unit: item.unit,

          delta: direction === "add" ? 1 : -1,
          direction,
          source: "scan",
        });
      }
      setScanOpen(false);
      return;
    }

    if (direction === "remove") {
      setScanOpen(false);
      return;
    }
    setPendingBarcode(barcode);
    setScanOpen(false);
  }

  function resolveRegistration(input: {
    itemId?: string;
    newItemName?: string;
  }) {
    if (!pendingBarcode) {
      return;
    }
    if (input.itemId) {
      register(pendingBarcode, input.itemId);
      const item = items.find((candidate) => candidate.id === input.itemId);
      if (item) {
        applyEntry({
          itemId: item.id,
          unit: item.unit,

          delta: 1,
          direction: "add",
          source: "scan",
        });
      }
    } else if (input.newItemName) {
      const entry = applyEntry({
        newItemName: input.newItemName,
        unit: "count",

        delta: 1,
        direction: "add",
        source: "scan",
      });
      if (entry) {
        register(pendingBarcode, entry.itemId);
      }
    }
    setPendingBarcode(null);
  }

  return (
    <div className="px-2 sm:px-0">
      <button
        type="button"
        onClick={() => setPanelOpen((current) => !current)}
        aria-expanded={panelOpen}
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
      >
        {panelOpen ? "Close batch update" : "Batch update"}
      </button>

      {panelOpen && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex rounded border border-zinc-300 p-0.5 text-sm dark:border-zinc-700">
              {(["add", "remove"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDirection(option)}
                  aria-pressed={direction === option}
                  className={`rounded px-3 py-1 capitalize ${
                    direction === option
                      ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setScanOpen((current) => !current)}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              >
                Scan
              </button>
              {scanOpen && (
                <div className="absolute top-full right-0 z-10 mt-1 w-64">
                  <BatchScanCamera
                    className="h-40 w-full"
                    onSimulateScan={handleScan}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-3">
            <BatchItemEntryRow
              idPrefix="variant-c"
              items={items}
              allowCreate={direction === "add"}
              actionLabel={direction === "add" ? "Add" : "Remove"}
              onCommit={({ itemId, newItemName, unit, quantity }) =>
                applyEntry({
                  itemId,
                  newItemName,
                  unit,
                  delta: direction === "add" ? quantity : -quantity,
                  direction,
                  source: "manual",
                })
              }
            />
          </div>

          {pendingBarcode && (
            <div className="mt-3">
              <BarcodeRegisterPanel
                barcode={pendingBarcode}
                items={items}
                onResolve={resolveRegistration}
                onCancel={() => setPendingBarcode(null)}
              />
            </div>
          )}
        </div>
      )}

      {panelOpen && (
        <div className="mt-3 overflow-x-auto sm:rounded-lg sm:border sm:border-zinc-200 dark:sm:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-2 py-2 font-medium text-zinc-600 sm:px-4 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-2 py-2 font-medium text-zinc-600 sm:px-4 dark:text-zinc-400">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {touchedFirst.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${
                    touchedIds.includes(item.id)
                      ? "bg-emerald-50 dark:bg-emerald-950/40"
                      : ""
                  }`}
                >
                  <td className="px-2 py-2 sm:px-4">{item.name}</td>
                  <td className="px-2 py-2 sm:px-4">
                    {item.quantity} {item.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
