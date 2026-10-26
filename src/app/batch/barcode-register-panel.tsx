"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { BatchDirection } from "./batch-entry";
import {
  matchBatchItems,
  type BatchCommitTarget,
  type BatchItemOption,
} from "./batch-entry-row";
import {
  suggestScannedProductName,
  type BarcodeRegistrationChoice,
} from "./scan-actions";
import { KEYBOARD_DIALOG_CLASS } from "@/app/dialog-styles";
import type { ScannedBarcode } from "@/lib/barcode";
import {
  formatQuantity,
  PANTRY_ITEM_UNITS,
  parseQuantity,
  type PantryItemUnit,
} from "@/lib/pantry-item";
import type { ProductNameSuggestion } from "@/lib/product-names";

type Props = {
  barcode: ScannedBarcode;
  // "register": an unregistered scan in add mode. "correct": "Wrong item?"
  // on a logged scan, repointing a barcode that's already registered.
  mode: "register" | "correct";
  // "correct" only: the item the scan was wrongly counted against, whose
  // change has already been undone.
  wrongItemName?: string;
  items: BatchItemOption[];
  // Remove never creates (PER-278's locked decision).
  direction: BatchDirection;
  pending: boolean;
  error: string | null;
  onPick: (choice: BarcodeRegistrationChoice) => void;
  onCancel: () => void;
};

const ROW_BUTTON_CLASS =
  "block w-full px-3 py-2.5 text-left text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 sm:py-1.5 dark:text-zinc-300 dark:hover:bg-zinc-800";

// The item picked (or named) in step one, waiting on its per-scan amount.
// unit is null for a new item, whose unit is chosen alongside the amount.
type ChosenItem = {
  target: BatchCommitTarget;
  name: string;
  unit: PantryItemUnit | null;
};

// "Looking up" while the background lookup is in flight; null once it
// settles on nothing (a miss is silent, ADR 0008) or the chip is dismissed.
type SuggestionState = "loading" | ProductNameSuggestion | null;

// The pick-or-create card (prototyped in PER-278 as an inline panel; a
// modal card since phone QA found the keyboard covering it below the
// camera): choose which
// pantry item a barcode belongs to, or name a new one, then say how much one
// scan of it is (ADR 0007's amendment) — a 500 g bag's barcode should add
// 500 g, not 1. For a first scan it also asks for a name suggestion in the
// background — shown as a chip the household can tap to copy into the
// field, never written in on its own.
export function BarcodeRegisterPanel({
  barcode,
  mode,
  wrongItemName,
  items,
  direction,
  pending,
  error,
  onPick,
  onCancel,
}: Props) {
  const headingId = useId();
  const fieldId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Mounted only while there's a barcode to settle, so opening on mount
  // is the whole lifecycle — same as ReassignBarcodeDialog.
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  const allowCreate = direction === "add";
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<ChosenItem | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionState>(
    mode === "register" ? "loading" : null,
  );

  useEffect(() => {
    if (mode !== "register") {
      return;
    }
    let cancelled = false;
    suggestScannedProductName(barcode.value)
      .catch(() => null)
      .then((found) => {
        if (!cancelled) {
          setSuggestion(found);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [barcode.value, mode]);

  const { trimmed, matches, exactMatch, canCreate } = matchBatchItems(
    items,
    query,
    allowCreate,
  );

  function chooseExisting(item: BatchItemOption) {
    setChosen({
      target: { itemId: item.id },
      name: item.name,
      unit: item.unit,
    });
  }

  function chooseNew() {
    setChosen({ target: { newItemName: trimmed }, name: trimmed, unit: null });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onClose={onCancel}
      className={`${KEYBOARD_DIALOG_CLASS} text-sm sm:max-w-md`}
    >
      <h2
        id={headingId}
        className="text-lg font-semibold text-black dark:text-zinc-50"
      >
        {mode === "register" ? "New barcode" : "Change barcode item"}
      </h2>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        {mode === "register"
          ? `${barcode.value} isn't registered yet. Pick the pantry item it belongs to${allowCreate ? ", or add it as new" : ""}.`
          : `Undid the scan on ${wrongItemName}. Pick the pantry item ${barcode.value} should count as instead.`}
      </p>

      {chosen ? (
        <ScanAmountStep
          key={chosen.name}
          chosen={chosen}
          direction={direction}
          pending={pending}
          onBack={() => setChosen(null)}
          onConfirm={(quantityPerScan, unit) =>
            onPick({
              target: chosen.target,
              quantityPerScan,
              newItemUnit: chosen.unit === null ? unit : undefined,
            })
          }
        />
      ) : (
        <>
          <label htmlFor={fieldId} className="sr-only">
            Pantry item
          </label>
          <input
            id={fieldId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Same rule as the entry row's Enter: an exact name match is that
              // item, anything else is a new one (add mode only).
              if (event.key !== "Enter" || pending) {
                return;
              }
              event.preventDefault();
              if (exactMatch) {
                chooseExisting(exactMatch);
              } else if (canCreate) {
                chooseNew();
              }
            }}
            enterKeyHint="done"
            placeholder={
              allowCreate ? "Search or add an item" : "Search for an item"
            }
            autoComplete="off"
            autoFocus
            className="mt-3 h-11 w-full rounded border border-zinc-300 bg-white px-3 sm:h-10 dark:border-zinc-700 dark:bg-zinc-900"
          />

          {suggestion === "loading" && (
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Looking up product…
            </p>
          )}
          {suggestion && suggestion !== "loading" && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => setQuery(suggestion.name)}
                  aria-label={`Use suggested name ${suggestion.name}`}
                  className="py-2 pr-1 pl-3 text-zinc-800 sm:py-1 dark:text-zinc-200"
                >
                  {suggestion.name}
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestion(null)}
                  aria-label="Dismiss suggestion"
                  className="p-2 text-zinc-400 hover:text-zinc-600 sm:p-1.5 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
              {suggestion.source === "open_food_facts" && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  via{" "}
                  <a
                    href="https://world.openfoodfacts.org"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Open Food Facts
                  </a>
                </span>
              )}
            </div>
          )}

          {trimmed.length > 0 && (matches.length > 0 || !canCreate) && (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded border border-zinc-200 bg-white py-1 dark:border-zinc-700 dark:bg-zinc-900">
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => chooseExisting(item)}
                    disabled={pending}
                    className={ROW_BUTTON_CLASS}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
              {matches.length === 0 && (
                <li className="px-3 py-1.5 text-zinc-500 dark:text-zinc-500">
                  No matches
                </li>
              )}
            </ul>
          )}

          {/* The way to finish a first scan, so it's styled as the page's
          primary action rather than one more row under the field. */}
          {canCreate && (
            <button
              type="button"
              onClick={chooseNew}
              disabled={pending}
              className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded bg-black px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 dark:bg-zinc-50 dark:text-black"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Add &ldquo;{trimmed}&rdquo; as a new item
              </span>
            </button>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-2 text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="mt-2 -mb-1 py-2 text-zinc-600 underline sm:py-1 sm:text-xs dark:text-zinc-400"
      >
        Cancel
      </button>
    </dialog>
  );
}

const UNIT_LABEL: Partial<Record<PantryItemUnit, string>> = { count: "items" };

// Step two: how much one scan of this barcode is. An existing item's unit
// is fixed; a new item picks one here, since "500" of something counted
// one by one makes no sense.
function ScanAmountStep({
  chosen,
  direction,
  pending,
  onBack,
  onConfirm,
}: {
  chosen: ChosenItem;
  direction: BatchDirection;
  pending: boolean;
  onBack: () => void;
  onConfirm: (quantityPerScan: string, unit: PantryItemUnit) => void;
}) {
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
