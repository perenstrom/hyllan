"use client";

import { ScanBarcode } from "lucide-react";
import { useState } from "react";

import type { PrototypeItem } from "./batch-entry-prototype-session";
import type { PantryItemUnit } from "@/lib/pantry-item";

// PER-278 prototype infrastructure — the one piece of UI every variant
// needs identically (the locked decision already fixes its shape: an
// explicit quantity field, immediate apply, remove-never-creates). Shared
// across variants like a <Header> would be — the variants disagree about
// where this sits and how it surfaces, not about what it is.
type Props = {
  idPrefix: string;
  items: PrototypeItem[];
  allowCreate: boolean;
  actionLabel: string;
  onCommit: (input: {
    itemId?: string;
    newItemName?: string;
    unit: PantryItemUnit;
    quantity: number;
  }) => void;
  // The scan icon lives inside the search bar, but the camera panel it
  // opens is the page's to render (it sits alongside the registration
  // flow, which this row knows nothing about) — so this row only ever
  // reports the toggle, never owns the open/closed state itself.
  onToggleScan?: () => void;
  scanActive?: boolean;
};

export function BatchItemEntryRow({
  idPrefix,
  items,
  allowCreate,
  actionLabel,
  onCommit,
  onToggleScan,
  scanActive,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();
  const matches = items.filter((item) =>
    item.name.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const exactMatch = items.find(
    (item) => item.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = allowCreate && trimmed.length > 0 && !exactMatch;

  function selectExisting(item: PrototypeItem) {
    setQuery(item.name);
    setSelectedId(item.id);
    setOpen(false);
    setError(null);
  }

  function commit() {
    const qty = Number(quantity);
    if (!trimmed || !Number.isFinite(qty) || qty <= 0) {
      return;
    }

    const target =
      (selectedId && items.find((item) => item.id === selectedId)) ||
      exactMatch;

    if (target) {
      onCommit({ itemId: target.id, unit: target.unit, quantity: qty });
    } else if (allowCreate) {
      onCommit({ newItemName: trimmed, unit: "count", quantity: qty });
    } else {
      setError(`No item matches "${trimmed}" — remove can't create one.`);
      return;
    }

    setQuery("");
    setSelectedId(null);
    setQuantity("1");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <label
            htmlFor={`${idPrefix}-item`}
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            Item
          </label>
          <div className="relative mt-1">
            <input
              id={`${idPrefix}-item`}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedId(null);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 100)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                }
              }}
              placeholder={
                allowCreate ? "Search or add an item" : "Search for an item"
              }
              autoComplete="off"
              className={`h-10 w-full rounded border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900 ${
                onToggleScan ? "pr-9" : ""
              }`}
            />
            {onToggleScan && (
              <button
                type="button"
                onClick={onToggleScan}
                aria-pressed={scanActive}
                aria-label={
                  scanActive ? "Close barcode scanner" : "Scan a barcode"
                }
                className={`absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 ${
                  scanActive ? "bg-zinc-200 dark:bg-zinc-700" : ""
                }`}
              >
                <ScanBarcode className="h-4 w-4" />
              </button>
            )}
          </div>
          {open && trimmed.length > 0 && (
            <ul className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={() => selectExisting(item)}
                    className="block w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {item.name}{" "}
                    <span className="text-zinc-500 dark:text-zinc-500">
                      ({item.quantity} {item.unit})
                    </span>
                  </button>
                </li>
              ))}
              {canCreate && (
                <li>
                  <button
                    type="button"
                    onMouseDown={() => setOpen(false)}
                    className="block w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Add &ldquo;{trimmed}&rdquo; as a new item
                  </button>
                </li>
              )}
              {matches.length === 0 && !canCreate && (
                <li className="px-3 py-1.5 text-zinc-500 dark:text-zinc-500">
                  No matches
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="w-full sm:w-24">
          <label
            htmlFor={`${idPrefix}-quantity`}
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            Quantity
          </label>
          <input
            id={`${idPrefix}-quantity`}
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              }
            }}
            className="mt-1 h-10 w-full rounded border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <button
          type="button"
          onClick={commit}
          className="h-10 shrink-0 rounded bg-black px-4 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
        >
          {actionLabel}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
