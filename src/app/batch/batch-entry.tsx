"use client";

import { Keyboard, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import {
  adjustBatchItem,
  createBatchItem,
  type BatchEntryChange,
} from "./actions";
import { BarcodeRegisterPanel } from "./barcode-register-panel";
import { BarcodeScanner } from "./barcode-scanner";
import {
  BatchEntryRow,
  type BatchCommitTarget,
  type BatchItemOption,
} from "./batch-entry-row";
import { ReassignBarcodeDialog } from "./reassign-barcode-dialog";
import { registerScannedBarcode, scanBatchBarcode } from "./scan-actions";
import type { ScannedBarcode } from "@/lib/barcode";
import { formatQuantity } from "@/lib/pantry-item";

export type BatchDirection = "add" | "remove";

type LogEntry = BatchEntryChange & {
  id: number;
  // Set on the original once it's been reversed — it stays in the log,
  // struck through, so the session stays an honest record of everything
  // that was applied.
  reversed: boolean;
  isReversal: boolean;
};

// An open pick-or-create panel: for a first scan of an unregistered
// barcode, or for "Wrong item?" correcting a logged scan's registration.
type RegisterRequest =
  | { barcode: ScannedBarcode; mode: "register" }
  | { barcode: ScannedBarcode; mode: "correct"; wrongItemName: string };

// A pick that hit a registration on another item, waiting on the
// household to confirm the move (ADR 0007).
type ReassignRequest = {
  target: BatchCommitTarget;
  fromItemName: string;
  toItemName: string;
};

type Props = {
  direction: BatchDirection;
  items: BatchItemOption[];
};

function negate(delta: string) {
  if (delta.startsWith("-")) {
    return delta.slice(1);
  }
  return Number(delta) === 0 ? delta : `-${delta}`;
}

function formatDelta(delta: string, unit: BatchEntryChange["unit"]) {
  const sign = delta.startsWith("-") ? "−" : "+";
  return `${sign}${formatQuantity(delta.replace(/^-/, ""), unit)}`;
}

// Batch entry (PER-307, prototyped in PER-278): a dedicated Add or Remove
// page where every commit applies immediately against the item's
// unassigned bucket, with a newest-first session log whose entries can
// each be reversed. Reversing is a real mutation — the inverse of the
// delta actually applied, against the item's *current* quantity — not a
// rollback to the value at commit time.
//
// Scanning (PER-308) is a second input method on the same page: the
// item field's scan icon opens the camera, a registered barcode applies a
// flat ±1, and an unregistered one opens the pick-or-create panel (add
// mode only — remove never creates).
export function BatchEntry({ direction, items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [registerRequest, setRegisterRequest] =
    useState<RegisterRequest | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [reassignRequest, setReassignRequest] =
    useState<ReassignRequest | null>(null);
  const nextEntryId = useRef(0);

  // Keeps the picker's per-item totals current with what the server
  // reported, and makes an inline-created item pickable straight away.
  function record(
    change: BatchEntryChange,
    flags: Pick<LogEntry, "isReversal">,
  ) {
    setItems((current) => {
      const updated = {
        id: change.itemId,
        name: change.itemName,
        unit: change.unit,
        quantity: change.total,
      };
      return current.some((item) => item.id === change.itemId)
        ? current.map((item) => (item.id === change.itemId ? updated : item))
        : [...current, updated];
    });
    const entry: LogEntry = {
      ...change,
      ...flags,
      id: nextEntryId.current++,
      reversed: false,
    };
    setEntries((current) => [entry, ...current]);
    return entry;
  }

  async function run<T>(action: () => Promise<T>) {
    setPending(true);
    try {
      return await action();
    } finally {
      setPending(false);
    }
  }

  async function commit(
    target: BatchCommitTarget,
    quantity: string,
  ): Promise<string | null> {
    const result = await run(() =>
      "itemId" in target
        ? adjustBatchItem(
            target.itemId,
            direction === "add" ? quantity : `-${quantity}`,
          )
        : createBatchItem(target.newItemName, quantity),
    );
    if (!result.ok) {
      return result.error;
    }
    return recordApplied(result.entry);
  }

  // Batch entry only removes from the unassigned bucket, so an item whose
  // stock all sits at Locations (or is already at zero there) clamps to a
  // no-op — say so rather than logging a "+0" that reads like success.
  function recordApplied(change: BatchEntryChange): string | null {
    if (Number(change.delta) === 0) {
      return `Nothing removed — ${change.itemName} has no unassigned stock.`;
    }
    record(change, { isReversal: false });
    return null;
  }

  async function handleDetected(rawValue: string, format: string) {
    setScanMessage(null);
    const result = await run(() =>
      scanBatchBarcode(rawValue, format, direction),
    );
    if (!result.ok) {
      setScanMessage({ text: result.error, isError: true });
    } else if (result.kind === "applied") {
      const failure = recordApplied(result.entry);
      if (failure) {
        setScanMessage({ text: failure, isError: true });
      }
    } else if (direction === "add") {
      openRegister({ barcode: result.barcode, mode: "register" });
    } else {
      setScanMessage({
        text: `${result.barcode.value} isn't registered to an item yet — scan it on Add stock to register it.`,
        isError: false,
      });
    }
  }

  function openRegister(request: RegisterRequest) {
    setRegisterError(null);
    setRegisterRequest(request);
  }

  function closeRegister() {
    setRegisterRequest(null);
    setReassignRequest(null);
  }

  async function pick(target: BatchCommitTarget, reassign = false) {
    if (!registerRequest) {
      return;
    }
    setRegisterError(null);
    const result = await run(() =>
      registerScannedBarcode(
        registerRequest.barcode,
        target,
        direction,
        reassign,
      ),
    );
    if ("conflict" in result) {
      setReassignRequest({
        target,
        fromItemName: result.conflict.itemName,
        toItemName:
          "itemId" in target
            ? (items.find((item) => item.id === target.itemId)?.name ??
              "this item")
            : target.newItemName.trim(),
      });
      return;
    }
    setReassignRequest(null);
    if (!result.ok) {
      setRegisterError(result.error);
      return;
    }
    // The barcode is registered either way by now, so the panel's job is
    // done even when a removal found nothing to take.
    closeRegister();
    const failure = recordApplied(result.entry);
    if (failure) {
      setScanMessage({ text: failure, isError: true });
    }
  }

  async function reverse(original: LogEntry) {
    setReverseError(null);
    const result = await run(() =>
      adjustBatchItem(original.itemId, negate(original.delta)),
    );
    if (!result.ok) {
      setReverseError(result.error);
      return false;
    }
    record(result.entry, { isReversal: true });
    setEntries((current) =>
      current.map((entry) =>
        entry.id === original.id ? { ...entry, reversed: true } : entry,
      ),
    );
    return true;
  }

  // "Wrong item?" on a logged scan: undo what it applied, then let the
  // household pick the item that barcode should really count as — which
  // repoints the registration (after confirming) and applies the scan
  // there instead.
  async function correctScan(original: LogEntry) {
    if (!original.barcode) {
      return;
    }
    const { barcode } = original;
    if (await reverse(original)) {
      openRegister({
        barcode,
        mode: "correct",
        wrongItemName: original.itemName,
      });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-5 pb-8 sm:px-0 sm:py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black sm:text-lg dark:text-zinc-50">
          {direction === "add" ? "Add stock" : "Remove stock"}
        </h1>
        <Link
          href="/"
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          Done
        </Link>
      </div>

      {/* Scanning takes over the top of the page: typing, the quantity
          (a scan always moves exactly one) and the Add/Remove button only
          get in the way while the camera is up. */}
      {scanning ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Scan a barcode to {direction === "add" ? "add" : "remove"} an item
          </p>
          <button
            type="button"
            onClick={() => {
              setScanning(false);
              setScanMessage(null);
            }}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded border border-zinc-300 px-3 text-sm text-zinc-700 sm:h-9 dark:border-zinc-700 dark:text-zinc-300"
          >
            <Keyboard className="h-4 w-4" aria-hidden="true" />
            Type instead
          </button>
        </div>
      ) : (
        <BatchEntryRow
          items={items}
          allowCreate={direction === "add"}
          actionLabel={direction === "add" ? "Add" : "Remove"}
          pending={pending}
          onCommit={commit}
          onStartScan={() => {
            setScanning(true);
            setScanMessage(null);
          }}
        />
      )}

      {scanMessage && (
        <p
          role={scanMessage.isError ? "alert" : "status"}
          className={`-mt-2 text-sm ${
            scanMessage.isError
              ? "text-red-600"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {scanMessage.text}
        </p>
      )}

      {scanning && (
        <BarcodeScanner
          paused={pending || registerRequest !== null}
          onDetected={(rawValue, format) =>
            void handleDetected(rawValue, format)
          }
        />
      )}

      {registerRequest && (
        <BarcodeRegisterPanel
          key={`${registerRequest.mode}:${registerRequest.barcode.value}`}
          barcode={registerRequest.barcode}
          mode={registerRequest.mode}
          wrongItemName={
            registerRequest.mode === "correct"
              ? registerRequest.wrongItemName
              : undefined
          }
          items={items}
          allowCreate={direction === "add"}
          pending={pending}
          error={registerError}
          onPick={(target) => void pick(target)}
          onCancel={closeRegister}
        />
      )}

      {reassignRequest && (
        <ReassignBarcodeDialog
          fromItemName={reassignRequest.fromItemName}
          toItemName={reassignRequest.toItemName}
          pending={pending}
          onConfirm={() => void pick(reassignRequest.target, true)}
          onCancel={() => setReassignRequest(null)}
        />
      )}

      <section>
        <h2
          id="batch-session-heading"
          className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
        >
          This session
        </h2>
        {reverseError && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {reverseError}
          </p>
        )}
        {entries.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            Nothing applied yet.
          </p>
        ) : (
          <ul
            aria-labelledby="batch-session-heading"
            className="mt-1 flex flex-col gap-1 text-sm"
          >
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={`flex items-center justify-between gap-2 rounded border border-zinc-200 bg-white px-3 py-2.5 sm:px-2 sm:py-1 dark:border-zinc-800 dark:bg-zinc-950 ${
                  entry.reversed ? "opacity-50" : ""
                }`}
              >
                {/* "Wrong item?" drops below the name on a phone, where a
                    long name beside it would squeeze the delta into wrapping. */}
                <span className="flex min-w-0 flex-col items-start sm:flex-row sm:items-center">
                  <span>
                    {entry.reversed ? (
                      <del>{entry.itemName}</del>
                    ) : (
                      entry.itemName
                    )}
                    {entry.barcode && !entry.isReversal && (
                      <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-500">
                        (scan)
                      </span>
                    )}
                    {entry.isReversal && (
                      <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-500">
                        (reversal)
                      </span>
                    )}
                  </span>
                  {entry.barcode && !entry.reversed && !entry.isReversal && (
                    <button
                      type="button"
                      onClick={() => void correctScan(entry)}
                      disabled={pending}
                      aria-label={`Wrong item? (${entry.itemName})`}
                      className="-mb-1 py-1 text-xs text-zinc-500 underline sm:-my-2 sm:ml-2 sm:py-2 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-200"
                    >
                      Wrong item?
                    </button>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                  <span
                    className={
                      entry.delta.startsWith("-")
                        ? "text-red-600"
                        : "text-emerald-600"
                    }
                  >
                    {formatDelta(entry.delta, entry.unit)} →{" "}
                    {formatQuantity(entry.total, entry.unit)}
                  </span>
                  {!entry.reversed && !entry.isReversal && (
                    <button
                      type="button"
                      onClick={() => reverse(entry)}
                      disabled={pending}
                      aria-label={`Reverse ${entry.itemName}`}
                      title="Undo"
                      className="-m-2 p-2 text-zinc-400 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-500 dark:hover:text-zinc-300"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
