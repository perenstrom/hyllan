"use client";

import { Plus } from "lucide-react";
import { useId, type ReactNode } from "react";

import { matchBatchItems, type BatchItemOption } from "./batch-entry-row";
import type { ChosenItem } from "./scan-amount-step";

type Props = {
  items: BatchItemOption[];
  // Owned by the card, so going back from step two keeps what was typed.
  query: string;
  onQueryChange: (query: string) => void;
  // Add mode only — remove never creates (PER-278's locked decision).
  allowCreate: boolean;
  pending: boolean;
  // Rendered under the field — the card's name-suggestion chip, if any.
  suggestion?: ReactNode;
  onChoose: (chosen: ChosenItem) => void;
};

const ROW_BUTTON_CLASS =
  "block w-full px-3 py-2.5 text-left text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 sm:py-1.5 dark:text-zinc-300 dark:hover:bg-zinc-800";

// Step one of the register card: which pantry item the barcode belongs
// to — an existing one from the matches, or a new one by the typed name.
export function BarcodeItemPicker({
  items,
  query,
  onQueryChange,
  allowCreate,
  pending,
  suggestion,
  onChoose,
}: Props) {
  const fieldId = useId();
  const { trimmed, matches, exactMatch, canCreate } = matchBatchItems(
    items,
    query,
    allowCreate,
  );

  function chooseExisting(item: BatchItemOption) {
    onChoose({ target: { itemId: item.id }, name: item.name, unit: item.unit });
  }

  function chooseNew() {
    onChoose({ target: { newItemName: trimmed }, name: trimmed, unit: null });
  }

  return (
    <>
      <label htmlFor={fieldId} className="sr-only">
        Pantry item
      </label>
      <input
        id={fieldId}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
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

      {suggestion}

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
  );
}
