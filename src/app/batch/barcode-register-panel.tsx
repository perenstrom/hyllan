"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import {
  matchBatchItems,
  type BatchCommitTarget,
  type BatchItemOption,
} from "./batch-entry-row";
import { suggestScannedProductName } from "./scan-actions";
import type { ScannedBarcode } from "@/lib/barcode";
import type { ProductNameSuggestion } from "@/lib/product-names";

type Props = {
  barcode: ScannedBarcode;
  // "register": an unregistered scan in add mode. "correct": "Wrong item?"
  // on a logged scan, repointing a barcode that's already registered.
  mode: "register" | "correct";
  // "correct" only: the item the scan was wrongly counted against, whose
  // ±1 has already been undone.
  wrongItemName?: string;
  items: BatchItemOption[];
  // Add mode only — remove never creates (PER-278's locked decision).
  allowCreate: boolean;
  pending: boolean;
  error: string | null;
  onPick: (target: BatchCommitTarget) => void;
  onCancel: () => void;
};

const ROW_BUTTON_CLASS =
  "block w-full px-3 py-2.5 text-left text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 sm:py-1.5 dark:text-zinc-300 dark:hover:bg-zinc-800";

// "Looking up" while the background lookup is in flight; null once it
// settles on nothing (a miss is silent, ADR 0008) or the chip is dismissed.
type SuggestionState = "loading" | ProductNameSuggestion | null;

// The inline pick-or-create panel (prototyped in PER-278): choose which
// pantry item a barcode belongs to, or name a new one. For a first scan it
// also asks for a name suggestion in the background — shown as a chip the
// household can tap to copy into the field, never written in on its own.
export function BarcodeRegisterPanel({
  barcode,
  mode,
  wrongItemName,
  items,
  allowCreate,
  pending,
  error,
  onPick,
  onCancel,
}: Props) {
  const headingId = useId();
  const fieldId = useId();
  const [query, setQuery] = useState("");
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

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950"
    >
      <h2
        id={headingId}
        className="font-medium text-amber-900 dark:text-amber-100"
      >
        {mode === "register" ? "New barcode" : "Change barcode item"}
      </h2>
      <p className="mt-0.5 text-amber-800 dark:text-amber-300">
        {mode === "register"
          ? `${barcode.value} isn't registered yet. Pick the pantry item it belongs to${allowCreate ? ", or add it as new" : ""}.`
          : `Undid the scan on ${wrongItemName}. Pick the pantry item ${barcode.value} should count as instead.`}
      </p>

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
            onPick({ itemId: exactMatch.id });
          } else if (canCreate) {
            onPick({ newItemName: trimmed });
          }
        }}
        enterKeyHint="done"
        placeholder={
          allowCreate ? "Search or add an item" : "Search for an item"
        }
        autoComplete="off"
        autoFocus
        className="mt-2 h-11 w-full rounded border border-amber-300 bg-white px-3 sm:h-10 dark:border-amber-700 dark:bg-zinc-900"
      />

      {suggestion === "loading" && (
        <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">
          Looking up product…
        </p>
      )}
      {suggestion && suggestion !== "loading" && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-white dark:border-amber-700 dark:bg-zinc-900">
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
            <span className="text-xs text-amber-800 dark:text-amber-300">
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
        <ul className="mt-2 max-h-48 overflow-y-auto rounded border border-amber-200 bg-white py-1 dark:border-amber-800 dark:bg-zinc-900">
          {matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onPick({ itemId: item.id })}
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
          onClick={() => onPick({ newItemName: trimmed })}
          disabled={pending}
          className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded bg-black px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 dark:bg-zinc-50 dark:text-black"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            Add &ldquo;{trimmed}&rdquo; as a new item
          </span>
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="mt-2 -mb-1 py-2 text-amber-800 underline sm:py-1 sm:text-xs dark:text-amber-300"
      >
        Cancel
      </button>
    </section>
  );
}
