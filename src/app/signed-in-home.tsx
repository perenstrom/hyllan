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
  sortPantryItems,
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

const SORT_STORAGE_KEY = "hyllan:pantry-sort";
const STATUS_FILTER_STORAGE_KEY = "hyllan:pantry-status-filter";
const LOCATION_FILTER_STORAGE_KEY = "hyllan:pantry-location-filter";

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

type GroupBy = "item" | "location";

function GroupByToggle({
  value,
  onChange,
}: {
  value: GroupBy;
  onChange: (next: GroupBy) => void;
}) {
  const options: { key: GroupBy; label: string }[] = [
    { key: "item", label: "By item" },
    { key: "location", label: "By location" },
  ];
  return (
    <div className="inline-flex rounded border border-zinc-300 p-0.5 text-sm dark:border-zinc-700">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          className={`rounded px-2.5 py-1 ${
            value === option.key
              ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {option.label}
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
    <div className="flex items-center gap-1.5">
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

function rowStatusClassFor(item: PantryItemWithLocations) {
  const status = getPantryItemStockStatus(item.quantity, item.minimumQuantity);
  return status === "out-of-stock"
    ? OUT_OF_STOCK_ROW_CLASS
    : status === "low-stock"
      ? LOW_STOCK_ROW_CLASS
      : "";
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

  // PER-278 prototype infrastructure — the launcher links below only ever
  // render outside production (see isPrototypeBuild below). Not part of the
  // real app; folded in on the throwaway prototype branch this ticket
  // points at, dropped from main once the ticket is resolved. The
  // /batch/add and /batch/remove pages fetch their own items server-side,
  // so nothing else here needs to know about them.
  const isPrototypeBuild = process.env.NODE_ENV !== "production";

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
      <main className="flex flex-1 flex-col gap-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between px-2 sm:px-0">
          <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
            Your pantry
          </h1>
          <div className="flex items-center gap-2">
            {optimisticItems.length > 0 && (
              <>
                <LocationFilterDropdown
                  locations={locations}
                  hiddenKeys={hiddenLocationKeys}
                  onToggle={handleLocationFilterToggle}
                />
                <StatusFilterDropdown
                  filter={statusFilter}
                  onChange={handleStatusFilterChange}
                />
              </>
            )}
            {isPrototypeBuild && (
              <>
                <Link
                  href="/batch/add"
                  className="rounded border border-dashed border-fuchsia-500 px-3 py-1.5 text-sm font-medium text-fuchsia-700 dark:text-fuchsia-300"
                >
                  Add stock
                </Link>
                <Link
                  href="/batch/remove"
                  className="rounded border border-dashed border-fuchsia-500 px-3 py-1.5 text-sm font-medium text-fuchsia-700 dark:text-fuchsia-300"
                >
                  Remove stock
                </Link>
              </>
            )}
            <Link
              href="/items/new"
              className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
            >
              + Add item
            </Link>
          </div>
        </div>

        {optimisticItems.length > 0 && (
          <div className="px-2 sm:px-0">
            <GroupByToggle value={groupBy} onChange={setGroupBy} />
          </div>
        )}

        {optimisticItems.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-lg text-zinc-600 dark:text-zinc-400">
            Your pantry is empty.
          </p>
        ) : displayItems.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-lg text-zinc-600 dark:text-zinc-400">
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
    <div className="overflow-x-auto sm:rounded-lg sm:border sm:border-zinc-200 dark:sm:border-zinc-800">
      {/* The Actions column is a fixed 3-element row at every
          viewport (ADR 0004, PER-266), so it no longer needs a
          minimum-width hack to avoid wrapping at narrow widths;
          horizontal scroll remains as a fallback for genuine edge
          cases like very long item names. */}
      <table className="w-full text-left text-sm">
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
            <th className="px-2 py-2 font-medium text-zinc-600 sm:px-4 dark:text-zinc-400">
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
            const status = getPantryItemStockStatus(
              item.quantity,
              item.minimumQuantity,
            );
            const rowStatusClass = rowStatusClassFor(item);

            return (
              <Fragment key={item.id}>
                <tr
                  className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${rowStatusClass}`}
                >
                  <td className="px-2 py-2 sm:px-4">
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
                      {status === "out-of-stock" && (
                        <span className="sr-only"> Out of stock</span>
                      )}
                      {status === "low-stock" && (
                        <span className="sr-only"> Low stock</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 sm:px-4">
                    {formatQuantity(item.quantity, item.unit)}
                  </td>
                  <td className="px-2 py-2 sm:px-4">
                    {isMulti ? (
                      <div className="flex items-center gap-1.5">
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
                      <td className="py-1.5 pr-2 pl-9 text-zinc-600 sm:pl-11 dark:text-zinc-400">
                        {locationLabel(bucket)}
                      </td>
                      <td className="px-2 py-1.5 sm:px-4">
                        {formatQuantity(bucket.quantity, item.unit)}
                      </td>
                      <td className="px-2 py-1.5 sm:px-4">
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
            <h2 className="px-2 pb-2 text-sm font-semibold text-black sm:px-0 dark:text-zinc-50">
              {sectionName}
            </h2>
            <div className="overflow-x-auto sm:rounded-lg sm:border sm:border-zinc-200 dark:sm:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-2 py-2 font-medium text-zinc-600 sm:px-4 dark:text-zinc-400">
                      Name
                    </th>
                    <th className="px-2 py-2 font-medium text-zinc-600 sm:px-4 dark:text-zinc-400">
                      Amount here
                    </th>
                    <th className="px-2 py-2 font-medium text-zinc-600 sm:px-4 dark:text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ item, bucket }) => (
                    <tr
                      key={item.id}
                      className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${rowStatusClassFor(item)}`}
                    >
                      <td className="px-2 py-2 sm:px-4">{item.name}</td>
                      <td className="px-2 py-2 sm:px-4">
                        {formatQuantity(bucket.quantity, item.unit)}
                      </td>
                      <td className="px-2 py-2 sm:px-4">
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
