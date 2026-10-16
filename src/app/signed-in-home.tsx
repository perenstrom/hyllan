"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useOptimistic, useState } from "react";

import { ACTION_BUTTON_CLASS, ACTION_ICON_CLASS } from "./action-button";
import { AppHeader } from "./app-header";
import { MinusIcon, PlusIcon } from "./icons";
import { decrementItem, incrementItem } from "./items/actions";
import { LocationFilterDropdown } from "./location-filter-dropdown";
import { RowActionsMenu } from "./row-actions-menu";
import { StatusFilterDropdown } from "./status-filter-dropdown";
import {
  activeBuckets,
  bucketsTotal,
  involvedLocationKeys,
  UNASSIGNED_KEY,
  visibleActiveBuckets,
  type LocationOption,
  type PantryItemBucket,
} from "@/lib/location";
import {
  DEFAULT_STATUS_FILTER,
  decrementQuantity,
  filterPantryItemsByStatus,
  formatQuantity,
  getPantryItemStockStatus,
  incrementQuantity,
  nextPantrySortState,
  parseStoredStatusFilter,
  sortPantryItems,
  STOCK_STATUS_LABELS,
  type PantryItemStockStatus,
  type PantrySortColumn,
  type PantrySortState,
  type PantryStatusFilter,
} from "@/lib/pantry-item";
import type { PantryItemWithLocations } from "@/lib/pantry-items";

type Props = {
  items: PantryItemWithLocations[];
  locations: LocationOption[];
};

type QuantityUpdate = {
  itemId: string;
  locationId: string | null;
  type: "increment" | "decrement";
};

// Mirrors the server's clamp (PER-226) so the optimistic value never
// predicts a decrement below zero that the server would then correct.
// Adjusts exactly the targeted (item, location) bucket, recomputing the
// item's displayed total (CONTEXT.md "Quantity") as the sum of its buckets.
function applyQuantityUpdate(
  items: PantryItemWithLocations[],
  update: QuantityUpdate,
): PantryItemWithLocations[] {
  return items.map((item) => {
    if (item.id !== update.itemId) {
      return item;
    }
    const buckets = item.buckets.map((bucket) =>
      bucket.locationId === update.locationId
        ? {
            ...bucket,
            quantity:
              update.type === "increment"
                ? incrementQuantity(bucket.quantity)
                : decrementQuantity(bucket.quantity),
          }
        : bucket,
    );
    return { ...item, buckets, quantity: bucketsTotal(buckets) };
  });
}

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

// Same treatment again for Empty (ADR 0004, PER-325), in neutral grey since
// an empty item isn't one the household restocks — zinc-600 on zinc-100
// (~7:1) and zinc-300 on zinc-900 (~12:1) both clear WCAG AA.
const EMPTY_ROW_CLASS =
  "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300";

const ROW_CLASS_BY_STATUS: Record<PantryItemStockStatus, string> = {
  "in-stock": "",
  "low-stock": LOW_STOCK_ROW_CLASS,
  "out-of-stock": OUT_OF_STOCK_ROW_CLASS,
  empty: EMPTY_ROW_CLASS,
};

// Batch entry's two entry points (PER-307) — outlined, so they read as
// secondary to the header's solid "+ Add item".
// Full-height, centered tap targets in the mobile bottom bar; the compact
// pill shape from sm up.
const BATCH_LINK_CLASS =
  "flex h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium whitespace-nowrap text-zinc-700 sm:h-auto sm:rounded sm:bg-transparent sm:py-1.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 sm:dark:bg-transparent";

const ADD_ITEM_LINK_CLASS =
  "flex h-11 items-center justify-center rounded-lg bg-black px-3 text-sm font-medium whitespace-nowrap text-white sm:h-auto sm:rounded sm:py-1.5 dark:bg-zinc-50 dark:text-black";

const SORT_STORAGE_KEY = "hyllan:pantry-sort";
const STATUS_FILTER_STORAGE_KEY = "hyllan:pantry-status-filter";
const LOCATION_FILTER_STORAGE_KEY = "hyllan:pantry-location-filter";

function readStoredStatusFilter(): PantryStatusFilter {
  if (typeof window === "undefined") {
    return DEFAULT_STATUS_FILTER;
  }
  try {
    return parseStoredStatusFilter(
      window.localStorage.getItem(STATUS_FILTER_STORAGE_KEY),
    );
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

// Stale ids (a location renamed away or deleted since the filter was saved)
// are dropped here rather than carried forward — an unknown key can never
// match a real bucket, so keeping it around would only shrink the trigger's
// "shown" count for no visible effect.
function readStoredLocationFilter(locations: LocationOption[]): Set<string> {
  const validKeys = new Set([
    ...locations.map((location) => location.id),
    UNASSIGNED_KEY,
  ]);
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(LOCATION_FILTER_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((key): key is string => validKeys.has(key)));
  } catch {
    return new Set();
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
    <th
      className="px-2 py-2 first:pl-4 sm:px-4 sm:first:pl-4"
      aria-sort={direction ?? "none"}
    >
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

type GroupBy = "item" | "location";

function GroupByToggle({
  value,
  onChange,
}: {
  value: GroupBy;
  onChange: (next: GroupBy) => void;
}) {
  // The shorter visible label below sm keeps the toggle and both filter
  // triggers on one row at phone width; the accessible name stays the full
  // label at every viewport.
  const options: { key: GroupBy; label: string; shortLabel: string }[] = [
    { key: "item", label: "By item", shortLabel: "Item" },
    { key: "location", label: "By location", shortLabel: "Location" },
  ];
  return (
    <div className="inline-flex h-9 rounded border border-zinc-300 bg-white p-0.5 text-sm whitespace-nowrap sm:h-auto sm:bg-transparent dark:border-zinc-700 dark:bg-zinc-900 sm:dark:bg-transparent">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          aria-label={option.label}
          className={`rounded px-2.5 py-1 ${
            value === option.key
              ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          <span className="sm:hidden">{option.shortLabel}</span>
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function locationLabel(bucket: Pick<PantryItemBucket, "locationName">) {
  return bucket.locationName ?? "Unassigned";
}

type BucketActionsProps = {
  itemId: string;
  itemName: string;
  bucket: PantryItemBucket;
  ariaSuffix: string;
  showOverflow: boolean;
  onIncrement: (itemId: string, locationId: string | null) => void;
  onDecrement: (itemId: string, locationId: string | null) => void;
};

// The row's direct +/- (acting on exactly one (item, location) bucket) plus
// an optional overflow trigger — shared by the by-item table's single-
// bucket rows, its expanded sub-rows, and the by-location table's rows
// (PER-288).
function BucketActions({
  itemId,
  itemName,
  bucket,
  ariaSuffix,
  showOverflow,
  onIncrement,
  onDecrement,
}: BucketActionsProps) {
  const disabled = Number(bucket.quantity) <= 0;
  return (
    <div className="flex items-center justify-end gap-2 sm:justify-start sm:gap-1.5">
      <form action={onDecrement.bind(null, itemId, bucket.locationId)}>
        <button
          type="submit"
          disabled={disabled}
          aria-label={`Decrease ${itemName} quantity${ariaSuffix}`}
          className={ACTION_BUTTON_CLASS}
        >
          <MinusIcon className={ACTION_ICON_CLASS} />
        </button>
      </form>
      <form action={onIncrement.bind(null, itemId, bucket.locationId)}>
        <button
          type="submit"
          aria-label={`Increase ${itemName} quantity${ariaSuffix}`}
          className={ACTION_BUTTON_CLASS}
        >
          <PlusIcon className={ACTION_ICON_CLASS} />
        </button>
      </form>
      {showOverflow && <RowActionsMenu itemId={itemId} itemName={itemName} />}
    </div>
  );
}

function stockStatusOf(item: PantryItemWithLocations) {
  return getPantryItemStockStatus(item.quantity, item.minimumQuantity);
}

// Always present for a tinted row, in both views, so assistive tech gets
// what the tint conveys visually.
function StockStatusLabel({ status }: { status: PantryItemStockStatus }) {
  if (status === "in-stock") {
    return null;
  }
  return <span className="sr-only"> {STOCK_STATUS_LABELS[status]}</span>;
}

export function SignedInHome({ items, locations }: Props) {
  const [optimisticItems, addOptimisticUpdate] = useOptimistic(
    items,
    applyQuantityUpdate,
  );

  const [sortState, setSortState] =
    useState<PantrySortState>(readStoredSortState);
  const [statusFilter, setStatusFilter] = useState<PantryStatusFilter>(
    readStoredStatusFilter,
  );
  const [hiddenLocationKeys, setHiddenLocationKeys] = useState<Set<string>>(
    () => readStoredLocationFilter(locations),
  );
  const [groupBy, setGroupBy] = useState<GroupBy>("item");

  // Starts with every (unfiltered) multi-location item already open (PER-288
  // review) — computed once from the initial items, not recomputed as
  // buckets change under editing, mirroring sort order's own frozen-order
  // rule below.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of items) {
      if (activeBuckets(item.buckets).length > 1) {
        initial.add(item.id);
      }
    }
    return initial;
  });

  function toggleExpanded(itemId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

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

  function handleLocationFilterToggle(key: string) {
    setHiddenLocationKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      window.localStorage.setItem(
        LOCATION_FILTER_STORAGE_KEY,
        JSON.stringify([...next]),
      );
      return next;
    });
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
  const statusVisibleIds = useMemo(
    () =>
      new Set(
        filterPantryItemsByStatus(optimisticItems, statusFilter).map(
          (item) => item.id,
        ),
      ),
    [optimisticItems, statusFilter],
  );
  // The location filter hides an item entirely once every bucket it holds
  // quantity in is hidden (PER-288) — not just whole-item membership, since
  // by-item view also needs to hide individual sub-rows (done at render
  // time via visibleActiveBuckets) without necessarily hiding the item.
  const locationVisibleIds = useMemo(
    () =>
      new Set(
        optimisticItems
          .filter((item) =>
            involvedLocationKeys(item.buckets).some(
              (key) => !hiddenLocationKeys.has(key),
            ),
          )
          .map((item) => item.id),
      ),
    [optimisticItems, hiddenLocationKeys],
  );
  const displayItems = orderedIds
    .map((id) => itemsById.get(id))
    .filter((item): item is PantryItemWithLocations => item !== undefined)
    .filter(
      (item) =>
        statusVisibleIds.has(item.id) && locationVisibleIds.has(item.id),
    );

  async function handleIncrement(itemId: string, locationId: string | null) {
    addOptimisticUpdate({ itemId, locationId, type: "increment" });
    await incrementItem(itemId, locationId);
  }

  async function handleDecrement(itemId: string, locationId: string | null) {
    addOptimisticUpdate({ itemId, locationId, type: "decrement" });
    await decrementItem(itemId, locationId);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <AppHeader />
      {/* Bottom padding below sm keeps the last row clear of the fixed
          mobile action bar. */}
      <main className="flex flex-1 flex-col gap-3 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:gap-4 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between px-4 sm:px-0">
          <h1 className="text-xl font-semibold text-black sm:text-lg dark:text-zinc-50">
            Your pantry
          </h1>
          {/* One group for the three primary actions: inline next to the
              title from sm up, a thumb-reachable bar pinned to the bottom
              of the screen below it. */}
          <nav
            aria-label="Pantry actions"
            className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 gap-2 border-t border-zinc-200 bg-zinc-50/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:flex sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none dark:border-zinc-800 dark:bg-black/95 sm:dark:bg-transparent"
          >
            <Link href="/batch/add" className={BATCH_LINK_CLASS}>
              Add stock
            </Link>
            <Link href="/batch/remove" className={BATCH_LINK_CLASS}>
              Remove stock
            </Link>
            <Link href="/items/new" className={ADD_ITEM_LINK_CLASS}>
              + Add item
            </Link>
          </nav>
        </div>

        {optimisticItems.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto px-4 sm:overflow-visible sm:px-0">
            <div className="shrink-0">
              <GroupByToggle value={groupBy} onChange={setGroupBy} />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <LocationFilterDropdown
                locations={locations}
                hiddenKeys={hiddenLocationKeys}
                onToggle={handleLocationFilterToggle}
              />
              <StatusFilterDropdown
                filter={statusFilter}
                onChange={handleStatusFilterChange}
              />
            </div>
          </div>
        )}

        {optimisticItems.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-4 text-center text-lg text-zinc-600 dark:text-zinc-400">
            Your pantry is empty.
          </p>
        ) : displayItems.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-4 text-center text-lg text-zinc-600 dark:text-zinc-400">
            No items match the current filter.
          </p>
        ) : groupBy === "item" ? (
          <ItemGroupedTable
            items={displayItems}
            sortState={sortState}
            onSort={handleHeaderClick}
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
            hiddenLocationKeys={hiddenLocationKeys}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
          />
        ) : (
          <LocationGroupedTables
            items={displayItems}
            locations={locations}
            hiddenLocationKeys={hiddenLocationKeys}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
          />
        )}
      </main>
    </div>
  );
}

type GroupedTableProps = {
  items: PantryItemWithLocations[];
  sortState: PantrySortState;
  onSort: (column: PantrySortColumn) => void;
  expandedIds: Set<string>;
  onToggleExpanded: (itemId: string) => void;
  hiddenLocationKeys: Set<string>;
  onIncrement: (itemId: string, locationId: string | null) => void;
  onDecrement: (itemId: string, locationId: string | null) => void;
};

function ItemGroupedTable({
  items,
  sortState,
  onSort,
  expandedIds,
  onToggleExpanded,
  hiddenLocationKeys,
  onIncrement,
  onDecrement,
}: GroupedTableProps) {
  return (
    <div className="overflow-x-auto border-y border-zinc-200 bg-white sm:rounded-lg sm:border sm:bg-transparent dark:border-zinc-800 dark:bg-zinc-950 sm:dark:bg-transparent">
      {/* The Actions column is a fixed 3-element row at every
          viewport (ADR 0004, PER-266), so it no longer needs a
          minimum-width hack to avoid wrapping at narrow widths;
          horizontal scroll remains as a fallback for genuine edge
          cases like very long item names. */}
      <table className="w-full text-left text-sm tabular-nums">
        <thead className="border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            <SortableHeader
              column="name"
              label="Name"
              sortState={sortState}
              onSort={onSort}
            />
            <SortableHeader
              column="amount"
              label="Amount"
              sortState={sortState}
              onSort={onSort}
            />
            <th className="py-2 pr-4 pl-2 text-right font-medium text-zinc-600 sm:px-4 sm:text-left dark:text-zinc-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const visibleBuckets = visibleActiveBuckets(
              item.buckets,
              hiddenLocationKeys,
            );
            const isMulti = visibleBuckets.length > 1;
            const isOpen = isMulti && expandedIds.has(item.id);
            const soleBucket = visibleBuckets[0];
            const status = stockStatusOf(item);
            const rowStatusClass = ROW_CLASS_BY_STATUS[status];

            return (
              <Fragment key={item.id}>
                <tr
                  className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${rowStatusClass}`}
                >
                  <td className="px-2 py-2.5 first:pl-4 last:pr-4 sm:px-4 sm:py-2">
                    <div className="flex items-center gap-1">
                      {isMulti ? (
                        <button
                          type="button"
                          onClick={() => onToggleExpanded(item.id)}
                          aria-label={
                            isOpen
                              ? `Collapse ${item.name} locations`
                              : `Expand ${item.name} locations`
                          }
                          className="text-zinc-500"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {item.name}
                      <StockStatusLabel status={status} />
                    </div>
                  </td>
                  <td className="px-2 py-2.5 first:pl-4 last:pr-4 sm:px-4 sm:py-2">
                    {formatQuantity(item.quantity, item.unit)}
                  </td>
                  <td className="px-2 py-2.5 first:pl-4 last:pr-4 sm:px-4 sm:py-2">
                    {isMulti ? (
                      <div className="flex items-center justify-end gap-1.5 sm:justify-start">
                        <span className="px-1 text-xs text-zinc-500 dark:text-zinc-500">
                          {isOpen ? "Expanded below" : "Expand to adjust"}
                        </span>
                        <RowActionsMenu itemId={item.id} itemName={item.name} />
                      </div>
                    ) : (
                      soleBucket && (
                        <BucketActions
                          itemId={item.id}
                          itemName={item.name}
                          bucket={soleBucket}
                          ariaSuffix=""
                          showOverflow
                          onIncrement={onIncrement}
                          onDecrement={onDecrement}
                        />
                      )
                    )}
                  </td>
                </tr>
                {isOpen &&
                  visibleBuckets.map((bucket) => (
                    <tr
                      key={`${item.id}-${bucket.locationId ?? UNASSIGNED_KEY}`}
                      className={`border-b border-zinc-100 bg-zinc-50/70 last:border-0 dark:border-zinc-900 dark:bg-zinc-900/40 ${rowStatusClass}`}
                    >
                      <td className="py-2 pr-2 pl-9 text-zinc-600 sm:py-1.5 sm:pl-11 dark:text-zinc-400">
                        {locationLabel(bucket)}
                      </td>
                      <td className="px-2 py-2 last:pr-4 sm:px-4 sm:py-1.5">
                        {formatQuantity(bucket.quantity, item.unit)}
                      </td>
                      <td className="px-2 py-2 last:pr-4 sm:px-4 sm:py-1.5">
                        <BucketActions
                          itemId={item.id}
                          itemName={item.name}
                          bucket={bucket}
                          ariaSuffix={` at ${locationLabel(bucket)}`}
                          showOverflow={false}
                          onIncrement={onIncrement}
                          onDecrement={onDecrement}
                        />
                      </td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type LocationGroupedProps = {
  items: PantryItemWithLocations[];
  locations: LocationOption[];
  hiddenLocationKeys: Set<string>;
  onIncrement: (itemId: string, locationId: string | null) => void;
  onDecrement: (itemId: string, locationId: string | null) => void;
};

function LocationGroupedTables({
  items,
  locations,
  hiddenLocationKeys,
  onIncrement,
  onDecrement,
}: LocationGroupedProps) {
  const orderedKeys = [
    ...locations.map((location) => location.id),
    UNASSIGNED_KEY,
  ].filter((key) => !hiddenLocationKeys.has(key));
  const nameByKey = new Map(
    locations.map((location) => [location.id, location.name]),
  );

  return (
    <div className="flex flex-col gap-6">
      {orderedKeys.map((key) => {
        const rows = items
          .map((item) => ({
            item,
            bucket: item.buckets.find(
              (bucket) => (bucket.locationId ?? UNASSIGNED_KEY) === key,
            ),
          }))
          .filter(
            (
              row,
            ): row is {
              item: PantryItemWithLocations;
              bucket: PantryItemBucket;
            } => row.bucket !== undefined && Number(row.bucket.quantity) > 0,
          );

        if (rows.length === 0) {
          return null;
        }

        const sectionName =
          key === UNASSIGNED_KEY ? "Unassigned" : nameByKey.get(key);

        return (
          <div key={key}>
            <h2 className="px-4 pb-2 text-sm font-semibold text-black sm:px-0 dark:text-zinc-50">
              {sectionName}
            </h2>
            <div className="overflow-x-auto border-y border-zinc-200 bg-white sm:rounded-lg sm:border sm:bg-transparent dark:border-zinc-800 dark:bg-zinc-950 sm:dark:bg-transparent">
              <table className="w-full text-left text-sm tabular-nums">
                <thead className="border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-2 py-2 font-medium text-zinc-600 first:pl-4 last:pr-4 last:text-right sm:px-4 sm:last:text-left dark:text-zinc-400">
                      Name
                    </th>
                    <th className="px-2 py-2 font-medium text-zinc-600 first:pl-4 last:pr-4 last:text-right sm:px-4 sm:last:text-left dark:text-zinc-400">
                      Amount here
                    </th>
                    <th className="px-2 py-2 font-medium text-zinc-600 first:pl-4 last:pr-4 last:text-right sm:px-4 sm:last:text-left dark:text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ item, bucket }) => {
                    const status = stockStatusOf(item);
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${ROW_CLASS_BY_STATUS[status]}`}
                      >
                        <td className="px-2 py-2.5 first:pl-4 last:pr-4 sm:px-4 sm:py-2">
                          {item.name}
                          <StockStatusLabel status={status} />
                        </td>
                        <td className="px-2 py-2.5 first:pl-4 last:pr-4 sm:px-4 sm:py-2">
                          {formatQuantity(bucket.quantity, item.unit)}
                        </td>
                        <td className="px-2 py-2.5 first:pl-4 last:pr-4 sm:px-4 sm:py-2">
                          <BucketActions
                            itemId={item.id}
                            itemName={item.name}
                            bucket={bucket}
                            ariaSuffix={` at ${sectionName}`}
                            showOverflow
                            onIncrement={onIncrement}
                            onDecrement={onDecrement}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
