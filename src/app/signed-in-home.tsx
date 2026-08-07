"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useOptimistic, useState } from "react";

import { AppHeader } from "./app-header";
import { MinusIcon, PencilIcon, PlusIcon, TrashIcon } from "./icons";
import { decrementItem, deleteItem, incrementItem } from "./items/actions";
import { StatusFilterDropdown } from "./status-filter-dropdown";
import type { pantryItems } from "@/db/schema";
import {
  DEFAULT_STATUS_FILTER,
  decrementQuantity,
  filterPantryItemsByStatus,
  formatQuantity,
  getPantryItemStockStatus,
  incrementQuantity,
  nextPantrySortState,
  sortPantryItems,
  type PantrySortColumn,
  type PantrySortState,
  type PantryStatusFilter,
} from "@/lib/pantry-item";

type PantryItemRow = typeof pantryItems.$inferSelect;

type Props = {
  items: PantryItemRow[];
};

type QuantityUpdate = { itemId: string; type: "increment" | "decrement" };

// Mirrors the server's clamp (PER-226) so the optimistic value never
// predicts a decrement below zero that the server would then correct.
function applyQuantityUpdate(
  items: PantryItemRow[],
  update: QuantityUpdate,
): PantryItemRow[] {
  return items.map((item) =>
    item.id === update.itemId
      ? {
          ...item,
          quantity:
            update.type === "increment"
              ? incrementQuantity(item.quantity)
              : decrementQuantity(item.quantity),
        }
      : item,
  );
}

// 32px touch target per ADR 0004.
const ACTION_BUTTON_CLASS =
  "flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300";
const ACTION_ICON_CLASS = "h-4 w-4";

// Red tint, chosen over the page background alone (ADR 0004, PER-236) so
// out-of-stock rows are distinguishable without a mounting/unmounting label
// that would shift layout. zinc-600/zinc-300 replaces the prior
// zinc-400/zinc-600 muted text, which had the shades swapped and failed
// WCAG AA contrast against the plain background.
const OUT_OF_STOCK_ROW_CLASS =
  "bg-red-100 text-zinc-600 dark:bg-red-950 dark:text-zinc-300";

// Same tint-plus-sr-only-label treatment as out-of-stock, but amber rather
// than red (ADR 0004, PER-251) — contrast-checked against the same WCAG AA
// bar, reusing the same zinc-600/zinc-300 text pairing.
const LOW_STOCK_ROW_CLASS =
  "bg-amber-100 text-zinc-600 dark:bg-amber-950 dark:text-zinc-300";

const SORT_STORAGE_KEY = "hyllan:pantry-sort";
const STATUS_FILTER_STORAGE_KEY = "hyllan:pantry-status-filter";

function readStoredStatusFilter(): PantryStatusFilter {
  if (typeof window === "undefined") {
    return DEFAULT_STATUS_FILTER;
  }
  try {
    const raw = window.localStorage.getItem(STATUS_FILTER_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STATUS_FILTER;
    }
    const parsed = JSON.parse(raw) as Partial<PantryStatusFilter> | null;
    if (
      typeof parsed?.["in-stock"] === "boolean" &&
      typeof parsed?.["low-stock"] === "boolean" &&
      typeof parsed?.["out-of-stock"] === "boolean"
    ) {
      return {
        "in-stock": parsed["in-stock"],
        "low-stock": parsed["low-stock"],
        "out-of-stock": parsed["out-of-stock"],
      };
    }
    return DEFAULT_STATUS_FILTER;
  } catch {
    return DEFAULT_STATUS_FILTER;
  }
}

function readStoredSortState(): PantrySortState {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<
      NonNullable<PantrySortState>
    > | null;
    if (
      (parsed?.column === "name" || parsed?.column === "amount") &&
      (parsed.direction === "ascending" || parsed.direction === "descending")
    ) {
      return { column: parsed.column, direction: parsed.direction };
    }
    return null;
  } catch {
    return null;
  }
}

const SORT_HEADER_CLASS =
  "flex items-center gap-1 font-medium text-zinc-600 dark:text-zinc-400";

type SortableHeaderProps = {
  column: PantrySortColumn;
  label: string;
  sortState: PantrySortState;
  onSort: (column: PantrySortColumn) => void;
};

// Aria-sort belongs on the `<th>` itself (the actual ARIA columnheader) —
// a `<button>` doesn't support it — while the button inside stays the
// focusable, clickable control cycling the column's sort state.
function SortableHeader({
  column,
  label,
  sortState,
  onSort,
}: SortableHeaderProps) {
  const direction = sortState?.column === column ? sortState.direction : null;
  return (
    <th className="px-2 py-2 sm:px-4" aria-sort={direction ?? "none"}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={SORT_HEADER_CLASS}
      >
        {label}
        {direction === "ascending" && (
          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {direction === "descending" && (
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

export function SignedInHome({ items }: Props) {
  const [optimisticItems, addOptimisticUpdate] = useOptimistic(
    items,
    applyQuantityUpdate,
  );

  const [sortState, setSortState] =
    useState<PantrySortState>(readStoredSortState);
  const [statusFilter, setStatusFilter] = useState<PantryStatusFilter>(
    readStoredStatusFilter,
  );

  // Persisted directly in the click handler, not a useEffect watching
  // sortState — the write only ever happens in response to this click
  // (CODING_STANDARDS.md, "Don't use an Effect to respond to a user
  // action").
  function handleHeaderClick(column: PantrySortColumn) {
    setSortState((current) => {
      const next = nextPantrySortState(current, column);
      if (next) {
        window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(SORT_STORAGE_KEY);
      }
      return next;
    });
  }

  // Same "write in the handler, not an Effect" rule as sort state above.
  function handleStatusFilterChange(next: PantryStatusFilter) {
    setStatusFilter(next);
    window.localStorage.setItem(
      STATUS_FILTER_STORAGE_KEY,
      JSON.stringify(next),
    );
  }

  // Order is frozen against optimistic quantity/name changes (ADR 0004,
  // PER-249) — re-sorting only when the sort state changes or the set of
  // item ids changes (add/delete), never when an existing item's values
  // change, so rows don't jump under the cursor mid-click.
  const itemIdsKey = optimisticItems.map((item) => item.id).join(",");
  const orderedIds = useMemo(
    () => sortPantryItems(optimisticItems, sortState).map((item) => item.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortState, itemIdsKey],
  );
  const itemsById = useMemo(
    () => new Map(optimisticItems.map((item) => [item.id, item])),
    [optimisticItems],
  );
  // Filter membership, unlike sort order, tracks the live optimistic
  // quantity — a row must disappear the instant its status leaves the
  // filter (e.g. an optimistic decrement to zero), not stay frozen the way
  // ordering does.
  const visibleIds = useMemo(
    () =>
      new Set(
        filterPantryItemsByStatus(optimisticItems, statusFilter).map(
          (item) => item.id,
        ),
      ),
    [optimisticItems, statusFilter],
  );
  const displayItems = orderedIds
    .map((id) => itemsById.get(id))
    .filter((item): item is PantryItemRow => item !== undefined)
    .filter((item) => visibleIds.has(item.id));

  async function handleIncrement(itemId: string) {
    addOptimisticUpdate({ itemId, type: "increment" });
    await incrementItem(itemId);
  }

  async function handleDecrement(itemId: string) {
    addOptimisticUpdate({ itemId, type: "decrement" });
    await decrementItem(itemId);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between px-2 sm:px-0">
          <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
            Your pantry
          </h1>
          <div className="flex items-center gap-2">
            {optimisticItems.length > 0 && (
              <StatusFilterDropdown
                filter={statusFilter}
                onChange={handleStatusFilterChange}
              />
            )}
            <Link
              href="/items/new"
              className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
            >
              + Add item
            </Link>
          </div>
        </div>

        {optimisticItems.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-lg text-zinc-600 dark:text-zinc-400">
            Your pantry is empty.
          </p>
        ) : displayItems.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-lg text-zinc-600 dark:text-zinc-400">
            No items match the current filter.
          </p>
        ) : (
          <div className="overflow-x-auto sm:rounded-lg sm:border sm:border-zinc-200 dark:sm:border-zinc-800">
            {/* 320px comfortably fits a 375px viewport now that the table
                sits flush against the screen edge (no horizontal padding
                from `main` below sm), so the 2x2 actions grid (PER-233)
                doesn't push ordinary phone widths into scroll — only
                genuine edge cases like very long item names do. */}
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <SortableHeader
                    column="name"
                    label="Name"
                    sortState={sortState}
                    onSort={handleHeaderClick}
                  />
                  <SortableHeader
                    column="amount"
                    label="Amount"
                    sortState={sortState}
                    onSort={handleHeaderClick}
                  />
                  <th className="px-2 py-2 font-medium text-zinc-600 sm:px-4 dark:text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item) => {
                  const status = getPantryItemStockStatus(
                    item.quantity,
                    item.minimumQuantity,
                  );
                  const outOfStock = status === "out-of-stock";
                  const rowStatusClass = outOfStock
                    ? OUT_OF_STOCK_ROW_CLASS
                    : status === "low-stock"
                      ? LOW_STOCK_ROW_CLASS
                      : "";
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${rowStatusClass}`}
                    >
                      <td className="px-2 py-2 sm:px-4">
                        {item.name}
                        {status === "out-of-stock" && (
                          <span className="sr-only"> Out of stock</span>
                        )}
                        {status === "low-stock" && (
                          <span className="sr-only"> Low stock</span>
                        )}
                      </td>
                      <td className="px-2 py-2 sm:px-4">
                        {formatQuantity(item.quantity, item.unit)}
                      </td>
                      <td className="px-2 py-2 sm:px-4">
                        {/* 2x2 grid below sm (ADR 0004, PER-233) so the four
                            buttons' combined width stops being the table's
                            widest column and forcing horizontal scroll. */}
                        <div className="grid grid-cols-2 items-center gap-1.5 sm:flex">
                          <form action={handleDecrement.bind(null, item.id)}>
                            <button
                              type="submit"
                              disabled={outOfStock}
                              aria-label={`Decrease ${item.name} quantity`}
                              className={ACTION_BUTTON_CLASS}
                            >
                              <MinusIcon className={ACTION_ICON_CLASS} />
                            </button>
                          </form>
                          <form action={handleIncrement.bind(null, item.id)}>
                            <button
                              type="submit"
                              aria-label={`Increase ${item.name} quantity`}
                              className={ACTION_BUTTON_CLASS}
                            >
                              <PlusIcon className={ACTION_ICON_CLASS} />
                            </button>
                          </form>
                          <Link
                            href={`/items/${item.id}/edit`}
                            aria-label={`Edit ${item.name}`}
                            className={ACTION_BUTTON_CLASS}
                          >
                            <PencilIcon className={ACTION_ICON_CLASS} />
                          </Link>
                          <form action={deleteItem.bind(null, item.id)}>
                            <button
                              type="submit"
                              aria-label={`Delete ${item.name}`}
                              className={ACTION_BUTTON_CLASS}
                            >
                              <TrashIcon className={ACTION_ICON_CLASS} />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
