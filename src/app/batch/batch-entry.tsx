"use client";

import { Undo2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import {
  adjustBatchItem,
  createBatchItem,
  type BatchEntryChange,
  type BatchEntryResult,
} from "./actions";
import {
  BatchEntryRow,
  type BatchCommitTarget,
  type BatchItemOption,
} from "./batch-entry-row";
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
export function BatchEntry({ direction, items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);
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

  async function run(action: () => Promise<BatchEntryResult>) {
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
    // Batch entry only removes from the unassigned bucket, so an item whose
    // stock all sits at Locations (or is already at zero there) clamps to a
    // no-op — say so rather than logging a "+0" that reads like success.
    if (Number(result.entry.delta) === 0) {
      return `Nothing removed — ${result.entry.itemName} has no unassigned stock.`;
    }
    record(result.entry, { isReversal: false });
    return null;
  }

  async function reverse(original: LogEntry) {
    setReverseError(null);
    const result = await run(() =>
      adjustBatchItem(original.itemId, negate(original.delta)),
    );
    if (!result.ok) {
      setReverseError(result.error);
      return;
    }
    record(result.entry, { isReversal: true });
    setEntries((current) =>
      current.map((entry) =>
        entry.id === original.id ? { ...entry, reversed: true } : entry,
      ),
    );
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

      <BatchEntryRow
        items={items}
        allowCreate={direction === "add"}
        actionLabel={direction === "add" ? "Add" : "Remove"}
        pending={pending}
        onCommit={commit}
      />

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
                <span>
                  {entry.reversed ? (
                    <del>{entry.itemName}</del>
                  ) : (
                    entry.itemName
                  )}
                  {entry.isReversal && (
                    <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-500">
                      (reversal)
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
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
