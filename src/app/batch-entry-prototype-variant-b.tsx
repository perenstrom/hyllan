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

// Variant B — "Camera-first split view": Add and Remove are two separate
// launchers/dialogs (mirroring how the app already treats add vs. edit as
// separate focused forms) rather than one dialog with a mode toggle. Inside
// each, the camera is persistent and live the moment the dialog opens —
// not something you switch into — sitting above the manual entry row and
// feed, which stay live at the same time rather than being swapped out.
// Compare with Variant A (one dialog, mode toggle, camera replaces manual
// entry) and Variant C (no dialog at all).

type Props = {
  direction: BatchDirection;
  items: PrototypeItem[];
  onClose: () => void;
};

export function BatchEntryVariantB({
  direction,
  items: initialItems,
  onClose,
}: Props) {
  const { items, entries, applyEntry } = useBatchSession(initialItems);
  const { register, resolve } = useBarcodeRegistry(initialItems[0]?.id);
  const [cameraOn, setCameraOn] = useState(true);
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
        <h2 className="text-lg font-semibold text-black capitalize dark:text-zinc-50">
          {direction} stock
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          Done
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Camera
            </span>
            <button
              type="button"
              onClick={() => setCameraOn((current) => !current)}
              className="text-xs text-zinc-500 underline dark:text-zinc-500"
            >
              {cameraOn ? "Turn off" : "Turn on"}
            </button>
          </div>
          {cameraOn ? (
            <BatchScanCamera
              className="mt-1 h-36 w-full"
              onSimulateScan={handleScan}
            />
          ) : (
            <div className="mt-1 flex h-10 items-center rounded border border-dashed border-zinc-300 px-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-500">
              Camera off — manual entry only
            </div>
          )}
        </div>

        {pendingBarcode && (
          <BarcodeRegisterPanel
            barcode={pendingBarcode}
            items={items}
            onResolve={resolveRegistration}
            onCancel={() => setPendingBarcode(null)}
          />
        )}

        <BatchItemEntryRow
          idPrefix="variant-b"
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

        <div>
          <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            This session
          </h3>
          {entries.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              Nothing applied yet.
            </p>
          ) : (
            <ul className="mt-1 flex max-h-40 flex-col gap-1 overflow-y-auto text-sm">
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
