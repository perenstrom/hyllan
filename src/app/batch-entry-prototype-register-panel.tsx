"use client";

import { useState } from "react";

import type { PrototypeItem } from "./batch-entry-prototype-session";

// PER-278 prototype infrastructure — the inline "pick or create the pantry
// item on the spot" panel the map's Notes already lock in for an
// unregistered barcode scanned during batch-add. Shared across variants:
// its shape is fixed by that decision, only where/how it surfaces differs.
type Props = {
  barcode: string;
  items: PrototypeItem[];
  onResolve: (input: { itemId?: string; newItemName?: string }) => void;
  onCancel: () => void;
};

export function BarcodeRegisterPanel({
  barcode,
  items,
  onResolve,
  onCancel,
}: Props) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const matches = items.filter((item) =>
    item.name.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const exact = items.find(
    (item) => item.name.toLowerCase() === trimmed.toLowerCase(),
  );

  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
      <p className="font-medium text-amber-900 dark:text-amber-100">
        Unrecognized barcode ({barcode})
      </p>
      <p className="mt-0.5 text-amber-800 dark:text-amber-300">
        Pick the pantry item this barcode belongs to, or add it as new.
      </p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search or add an item"
        autoComplete="off"
        className="mt-2 h-10 w-full rounded border border-amber-300 bg-white px-3 dark:border-amber-700 dark:bg-zinc-900"
      />
      <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-amber-200 bg-white dark:border-amber-800 dark:bg-zinc-900">
        {matches.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onResolve({ itemId: item.id })}
              className="block w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-amber-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {item.name}
            </button>
          </li>
        ))}
        {trimmed.length > 0 && !exact && (
          <li>
            <button
              type="button"
              onClick={() => onResolve({ newItemName: trimmed })}
              className="block w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-amber-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Add &ldquo;{trimmed}&rdquo; as a new item
            </button>
          </li>
        )}
        {matches.length === 0 && trimmed.length === 0 && (
          <li className="px-3 py-1.5 text-zinc-500 dark:text-zinc-500">
            Start typing to search or add an item
          </li>
        )}
      </ul>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 text-xs text-amber-700 underline dark:text-amber-300"
      >
        Cancel
      </button>
    </div>
  );
}
