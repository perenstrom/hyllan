"use client";

import { ScanBarcode } from "lucide-react";
import { useRef, useState } from "react";

import {
  ACTION_BUTTON_BASE_CLASS,
  ACTION_ICON_CLASS,
} from "@/app/action-button";
import { MinusIcon, PlusIcon } from "@/app/icons";
import { LISTBOX_OPTION_CLASS } from "@/app/listbox-styles";
import { useListboxNavigation } from "@/app/use-listbox-navigation";
import type { PantryItemUnit } from "@/lib/pantry-item";
import { formatQuantity, parseQuantity } from "@/lib/pantry-item";

export type BatchItemOption = {
  id: string;
  name: string;
  unit: PantryItemUnit;
  quantity: string;
};

export type BatchCommitTarget = { itemId: string } | { newItemName: string };

type Props = {
  items: BatchItemOption[];
  // Add mode only — remove never creates (PER-278's locked decision).
  allowCreate: boolean;
  actionLabel: string;
  pending: boolean;
  // Resolves to an error message to show inline, or null on success.
  onCommit: (
    target: BatchCommitTarget,
    quantity: string,
  ) => Promise<string | null>;
  // The scan icon sits inside the item field, but the camera panel it
  // opens belongs to the page (it sits alongside the registration flow,
  // which this row knows nothing about), and the page swaps this row out
  // while scanning — so the row only reports the request (PER-308).
  onStartScan: () => void;
};

const DEFAULT_QUANTITY = "1";

// What a search-or-create field offers for what's typed: case-insensitive
// substring matches, the exact match (names are unique per household
// case-insensitively, ADR 0001), and whether "Add as a new item" applies.
// Shared with the barcode pick-or-create panel.
export function matchBatchItems(
  items: BatchItemOption[],
  query: string,
  allowCreate: boolean,
) {
  const trimmed = query.trim();
  const normalized = trimmed.toLowerCase();
  const exactMatch = items.find(
    (item) => item.name.toLowerCase() === normalized,
  );
  return {
    trimmed,
    matches: items.filter((item) =>
      item.name.toLowerCase().includes(normalized),
    ),
    exactMatch,
    canCreate: allowCreate && trimmed.length > 0 && !exactMatch,
  };
}

// The quick-entry row: a filtering autocomplete over the household's items
// (same pattern as ItemPickerCombobox/LocationPickerCombobox) plus an
// explicit quantity with the Actions column's +/- stepper shape (ADR
// 0004), clamped at 0. Enter in either field, or the action button,
// commits — except Enter on a highlighted list option, which picks it.
export function BatchEntryRow({
  items,
  allowCreate,
  actionLabel,
  pending,
  onCommit,
  onStartScan,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(DEFAULT_QUANTITY);
  const [error, setError] = useState<string | null>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  const { trimmed, matches, exactMatch, canCreate } = matchBatchItems(
    items,
    query,
    allowCreate,
  );

  function step(delta: number) {
    const current = Number(quantity);
    const base = Number.isFinite(current) ? current : 0;
    setQuantity(String(Math.max(0, base + delta)));
  }

  function selectExisting(item: BatchItemOption) {
    setQuery(item.name);
    setSelectedId(item.id);
    setOpen(false);
    setError(null);
  }

  async function commit() {
    if (pending || !trimmed) {
      return;
    }
    const parsed = parseQuantity(quantity);
    if (parsed === null || Number(parsed) <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }

    const target = items.find((item) => item.id === selectedId) ?? exactMatch;
    let commitTarget: BatchCommitTarget;
    if (target) {
      commitTarget = { itemId: target.id };
    } else if (allowCreate) {
      commitTarget = { newItemName: trimmed };
    } else {
      setOpen(false);
      setError(`No item matches “${trimmed}”.`);
      return;
    }

    // Clears the row up front rather than after the server answers, so
    // whatever's typed for the next entry while this one saves isn't wiped
    // when it lands. A failure puts the submitted values back to correct.
    const submitted = { query, selectedId, quantity };
    reset();
    const failure = await onCommit(commitTarget, parsed);
    if (failure) {
      setQuery(submitted.query);
      setSelectedId(submitted.selectedId);
      setQuantity(submitted.quantity);
      setError(failure);
    }
  }

  function reset() {
    setQuery("");
    setSelectedId(null);
    setQuantity(DEFAULT_QUANTITY);
    setOpen(false);
    setError(null);
  }

  function commitOnEnter(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    }
  }

  const listOpen = open && trimmed.length > 0;
  // Matches, then the "Add as a new item" row when it applies.
  const { inputProps, listboxProps, optionProps } = useListboxNavigation({
    optionCount: matches.length + (canCreate ? 1 : 0),
    open: listOpen,
    query,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    onActivate: (index) => {
      if (index < matches.length) {
        selectExisting(matches[index]);
        // From the keyboard the next thing to set is the amount.
        quantityRef.current?.focus();
      } else {
        void commit();
      }
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <label
            htmlFor="batch-item"
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            Item
          </label>
          <div className="relative mt-1">
            <input
              {...inputProps}
              id="batch-item"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedId(null);
                setOpen(true);
                setError(null);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 100)}
              onKeyDown={(event) => {
                // Arrows, Escape and Enter on a highlighted option belong
                // to the list; an unhighlighted Enter still commits.
                inputProps.onKeyDown(event);
                if (!event.defaultPrevented) {
                  commitOnEnter(event);
                }
              }}
              placeholder={
                allowCreate ? "Search or add an item" : "Search for an item"
              }
              autoComplete="off"
              className="h-11 w-full rounded border border-zinc-300 bg-white pr-12 pl-3 sm:h-10 sm:pr-10 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              onClick={onStartScan}
              aria-label="Scan a barcode"
              title="Scan a barcode"
              className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-zinc-500 hover:text-zinc-800 sm:h-8 sm:w-8 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ScanBarcode
                className="h-5 w-5 sm:h-4 sm:w-4"
                aria-hidden="true"
              />
            </button>
          </div>
          {listOpen && (
            <ul
              {...listboxProps}
              className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              {matches.map((item, index) => (
                <li
                  key={item.id}
                  {...optionProps(index)}
                  onMouseDown={() => selectExisting(item)}
                  className={LISTBOX_OPTION_CLASS}
                >
                  {item.name}{" "}
                  <span className="text-zinc-500 dark:text-zinc-500">
                    ({formatQuantity(item.quantity, item.unit)})
                  </span>
                </li>
              ))}
              {canCreate && (
                <li
                  {...optionProps(matches.length)}
                  onMouseDown={() => void commit()}
                  className={LISTBOX_OPTION_CLASS}
                >
                  Add &ldquo;{trimmed}&rdquo; as a new item
                </li>
              )}
              {matches.length === 0 && !canCreate && (
                <li
                  role="presentation"
                  className="px-3 py-1.5 text-zinc-500 dark:text-zinc-500"
                >
                  No matches
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="w-full sm:w-40">
          <label
            htmlFor="batch-quantity"
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            Quantity
          </label>
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={!(Number(quantity) > 0)}
              aria-label="Decrease quantity"
              className={`${ACTION_BUTTON_BASE_CLASS} h-11 w-11 shrink-0 sm:h-10 sm:w-10`}
            >
              <MinusIcon className={ACTION_ICON_CLASS} />
            </button>
            <input
              ref={quantityRef}
              id="batch-quantity"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => {
                setQuantity(event.target.value);
                setError(null);
              }}
              onKeyDown={commitOnEnter}
              className="h-11 w-full min-w-0 rounded border border-zinc-300 bg-white px-2 sm:h-10 text-center dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Increase quantity"
              className={`${ACTION_BUTTON_BASE_CLASS} h-11 w-11 shrink-0 sm:h-10 sm:w-10`}
            >
              <PlusIcon className={ACTION_ICON_CLASS} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void commit()}
          disabled={pending}
          className="h-11 shrink-0 rounded bg-black px-4 sm:h-10 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-black"
        >
          {actionLabel}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
