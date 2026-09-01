"use client";

import Link from "next/link";
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

// PER-278 prototype infrastructure — the requested combination: Variant B's
// split path (a separate Add/Remove entry point, camera live and persistent
// alongside manual entry) rendered as a real navigated page instead of a
// <dialog>. No modal chrome at all — a "Done" link is real in-app
// navigation back to "/", not a close handler; the browser back button
// works, and there's no focus trap to manage.
type Props = {
  direction: BatchDirection;
  items: PrototypeItem[];
};

export function BatchEntryPrototypePageBody({
  direction,
  items: initialItems,
}: Props) {
  const { items, entries, applyEntry } = useBatchSession(initialItems);
  const { register, resolve } = useBarcodeRegistry(initialItems[0]?.id);
  const [cameraOn, setCameraOn] = useState(true);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);

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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6 sm:px-0">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-black capitalize dark:text-zinc-50">
          {direction} stock
        </h1>
        <Link
          href="/"
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          Done
        </Link>
      </div>

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
            className="mt-1 h-48 w-full"
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
        idPrefix="batch-page"
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
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          This session
        </h2>
        {entries.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            Nothing applied yet.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-sm">
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
    </main>
  );
}
