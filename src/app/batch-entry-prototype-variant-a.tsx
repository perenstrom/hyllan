"use client";

import { useEffect, useRef, useState } from "react";

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
import { STOCK_TAKE_DIALOG_CLASS } from "./locations/stock-take-dialog-header";

// Variant A — "Unified session dialog": one entry point (a single "Batch
// update" launcher next to "+ Add item"), one dialog. Add/Remove is a mode
// toggle inside it, not two separate flows. Scanning replaces the search
// row inline with the camera, in the same dialog — camera and manual entry
// are mutually exclusive, never both on screen. Compare with Variant B
// (separate Add/Remove launchers, camera always visible alongside manual
// entry) and Variant C (no dialog at all).

type Props = {
  items: PrototypeItem[];
  onClose: () => void;
};

export function BatchEntryVariantA({ items: initialItems, onClose }: Props) {
  const { items, entries, applyEntry } = useBatchSession(initialItems);
  const { register, resolve } = useBarcodeRegistry(initialItems[0]?.id);
  const [direction, setDirection] = useState<BatchDirection>("add");
  const [scanning, setScanning] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

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
      return;
    }

    if (direction === "remove") {
      // Remove never creates (locked decision) — an unregistered barcode
      // in remove mode has nothing to resolve to.
      return;
    }
    setPendingBarcode(barcode);
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
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={`${STOCK_TAKE_DIALOG_CLASS} max-w-lg`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
          Batch update
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          Done
        </button>
      </div>

      <div className="mt-3 inline-flex rounded border border-zinc-300 p-0.5 text-sm dark:border-zinc-700">
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

      <div className="mt-4 flex flex-col gap-3">
        {scanning ? (
          <BatchScanCamera
            className="h-40 w-full"
            onSimulateScan={handleScan}
          />
        ) : (
          <BatchItemEntryRow
            idPrefix="variant-a"
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
        )}

        <button
          type="button"
          onClick={() => setScanning((current) => !current)}
          className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          {scanning ? "Switch to manual entry" : "Scan a barcode"}
        </button>

        {pendingBarcode && (
          <BarcodeRegisterPanel
            barcode={pendingBarcode}
            items={items}
            onResolve={resolveRegistration}
            onCancel={() => setPendingBarcode(null)}
          />
        )}

        <div className="mt-1">
          <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            This session
          </h3>
          {entries.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              Nothing applied yet.
            </p>
          ) : (
            <ul className="mt-1 flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded border border-zinc-100 px-2 py-1 dark:border-zinc-900"
                >
                  <span>
                    {entry.itemName}
                    {entry.source === "scan" && (
                      <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-500">
                        (scan)
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      entry.delta >= 0 ? "text-emerald-600" : "text-red-600"
                    }
                  >
                    {entry.delta >= 0 ? "+" : ""}
                    {entry.delta} → {entry.newTotal} {entry.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
