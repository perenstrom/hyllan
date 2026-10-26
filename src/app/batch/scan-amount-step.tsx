"use client";

import { useId, useState } from "react";

import type { BatchDirection } from "./batch-entry";
import type { BatchCommitTarget } from "./batch-entry-row";
import {
  formatQuantity,
  PANTRY_ITEM_UNITS,
  parseQuantity,
  type PantryItemUnit,
} from "@/lib/pantry-item";

// The item picked (or named) in step one, waiting on its per-scan amount.
// unit is null for a new item, whose unit is chosen alongside the amount.
export type ChosenItem = {
  target: BatchCommitTarget;
  name: string;
  unit: PantryItemUnit | null;
};

const UNIT_LABEL: Partial<Record<PantryItemUnit, string>> = { count: "items" };

type Props = {
  chosen: ChosenItem;
  direction: BatchDirection;
  pending: boolean;
  onBack: () => void;
  onConfirm: (quantityPerScan: string, unit: PantryItemUnit) => void;
};

// Step two of the register card: how much one scan of this barcode is
// (ADR 0007's amendment) — a 500 g bag's barcode should add 500 g, not 1.
// An existing item's unit is fixed; a new item picks one here, since "500"
// of something counted one by one makes no sense.
export function ScanAmountStep({
  chosen,
  direction,
  pending,
  onBack,
  onConfirm,
}: Props) {
  const amountId = useId();
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<PantryItemUnit>(chosen.unit ?? "count");
  const parsed = parseQuantity(amount.trim());
  const valid = parsed !== null && Number(parsed) > 0;
  const verb = direction === "add" ? "Add" : "Remove";

  function confirm() {
    if (valid && !pending) {
      onConfirm(parsed, unit);
    }
  }

  return (
    <>
      <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {chosen.name}
            {chosen.unit === null && (
              <span className="ml-1 text-xs font-normal text-zinc-500">
                (new item)
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="-my-2 py-2 text-xs text-zinc-600 underline dark:text-zinc-400"
          >
            Change
          </button>
        </div>
        <label
          htmlFor={amountId}
          className="mt-2 block text-zinc-600 dark:text-zinc-400"
        >
          Each scan of this barcode {direction === "add" ? "adds" : "removes"}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id={amountId}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            enterKeyHint="done"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirm();
              }
            }}
            autoFocus
            className="h-11 w-full min-w-0 rounded border border-zinc-300 bg-white px-3 sm:h-10 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {chosen.unit === null ? (
            <select
              aria-label="Unit"
              value={unit}
              onChange={(event) =>
                setUnit(event.target.value as PantryItemUnit)
              }
              className="h-11 w-28 shrink-0 rounded border border-zinc-300 bg-white px-2 sm:h-10 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {PANTRY_ITEM_UNITS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <span className="shrink-0 text-zinc-600 dark:text-zinc-400">
              {UNIT_LABEL[unit] ?? unit}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={confirm}
        disabled={!valid || pending}
        className="mt-2 flex h-11 w-full items-center justify-center rounded bg-black px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 dark:bg-zinc-50 dark:text-black"
      >
        {valid ? `${verb} ${formatQuantity(parsed, unit)}` : verb}
      </button>
    </>
  );
}
