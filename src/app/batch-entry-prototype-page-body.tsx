"use client";

import { Undo2 } from "lucide-react";
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

// PER-278 prototype infrastructure — Variant B's split path (a dedicated
// Add/Remove entry point) as a real page, not a <dialog>. "Done" is real
// in-app navigation back to "/", not a close handler — the browser back
// button works, and there's no focus trap to manage.
//
// The camera is off by default (review feedback): a barcode icon inside
// the search bar toggles it, rather than it being live the moment the page
// opens. Each session-log entry carries its own Reverse control, for "I
// scanned (or typed) the wrong thing" — see reverseEntry in the session
// hook for what that actually does to the item's quantity.
type Props = {
  direction: BatchDirection;
  items: PrototypeItem[];
};

export function BatchEntryPrototypePageBody({
  direction,
  items: initialItems,
}: Props) {
  const { items, entries, applyEntry, reverseEntry } =
    useBatchSession(initialItems);
  const { register, resolve } = useBarcodeRegistry(initialItems[0]?.id);
  const [scanning, setScanning] = useState(false);
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
        onToggleScan={() => setScanning((current) => !current)}
        scanActive={scanning}
      />

      {scanning && (
        <BatchScanCamera className="w-full" onSimulateScan={handleScan} />
      )}

      {pendingBarcode && (
        <BarcodeRegisterPanel
          barcode={pendingBarcode}
          items={items}
          onResolve={resolveRegistration}
          onCancel={() => setPendingBarcode(null)}
        />
      )}

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
            {entries.map((entry) => {
              const isReversed = Boolean(entry.reversedByEntryId);
              const isReversal = entry.source === "reversal";
              return (
                <li
                  key={entry.id}
                  className={`flex items-center justify-between gap-2 rounded border border-zinc-100 px-2 py-1 dark:border-zinc-900 ${
                    isReversed ? "opacity-50" : ""
                  }`}
                >
                  <span className={isReversed ? "line-through" : ""}>
                    {entry.itemName}
                    {entry.source === "scan" && (
                      <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-500">
                        (scan)
                      </span>
                    )}
                    {isReversal && (
                      <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-500">
                        (reversal)
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        entry.delta >= 0 ? "text-emerald-600" : "text-red-600"
                      }
                    >
                      {entry.delta >= 0 ? "+" : ""}
                      {entry.delta} → {entry.newTotal} {entry.unit}
                    </span>
                    {!isReversed && !isReversal && (
                      <button
                        type="button"
                        onClick={() => reverseEntry(entry.id)}
                        aria-label={`Reverse ${entry.itemName}`}
                        className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
