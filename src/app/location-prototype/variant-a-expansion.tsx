"use client";

// PROTOTYPE — wipe me. Variant A for PER-268 — the table format the
// 2026-08-18 review settled on. The item stays a single row in the
// existing dense table; multi-location items expand in place into indented
// per-location sub-rows, each independently adjustable, and start
// expanded by default (still collapsible via the chevron) rather than
// requiring a click to reveal. Single-bucket items (all-unassigned or one
// location) never show a chevron — their top-level +/- act directly on
// that one bucket, same as the real table today.
//
// 2026-08-18 follow-up review: the header's Locations filter previously
// only hid whole items from the list, but left a hidden location's
// sub-row visible inside every still-shown item's expansion — the actual
// bug that made the filter look broken. Fixed by filtering the bucket list
// itself, not just item membership. Also adds a grouping switch: "By item"
// is the table above; "By location" inverts it into one section per
// location, each listing the items holding quantity there.

import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";

import { PrototypeHeader } from "./prototype-header";
import { StubOverflowButton } from "./stub-overflow-button";
import { usePrototypeLocationState } from "./use-prototype-state";
import {
  activeBuckets,
  breakdownTotal,
  involvedBuckets,
  UNASSIGNED,
  type LocationBreakdown,
} from "./mock-data";
import { ACTION_BUTTON_CLASS, ACTION_ICON_CLASS } from "../action-button";
import { MinusIcon, PlusIcon } from "../icons";
import type { pantryItems } from "@/db/schema";
import { formatQuantity } from "@/lib/pantry-item";

type PantryItemRow = typeof pantryItems.$inferSelect;
type GroupBy = "item" | "location";

export function VariantA({ items }: { items: PantryItemRow[] }) {
  const {
    locations,
    breakdownFor,
    adjust,
    addLocation,
    hiddenLocations,
    toggleLocationVisibility,
  } = usePrototypeLocationState(items);
  const [groupBy, setGroupBy] = useState<GroupBy>("item");

  return (
    <main className="flex flex-1 flex-col gap-4 py-5 sm:px-6 sm:py-6">
      <PrototypeHeader
        locations={locations}
        hiddenLocations={hiddenLocations}
        onToggleLocation={toggleLocationVisibility}
        onCreateLocation={addLocation}
      />
      <div className="px-2 sm:px-0">
        <GroupByToggle value={groupBy} onChange={setGroupBy} />
      </div>
      {groupBy === "item" ? (
        <ItemGroupedTable
          items={items}
          breakdownFor={breakdownFor}
          adjust={adjust}
          hiddenLocations={hiddenLocations}
        />
      ) : (
        <LocationGroupedTable
          items={items}
          locations={locations}
          breakdownFor={breakdownFor}
          adjust={adjust}
          hiddenLocations={hiddenLocations}
        />
      )}
    </main>
  );
}

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

type BreakdownFor = (itemId: string) => LocationBreakdown;
type Adjust = (itemId: string, bucket: string, delta: number) => void;

function ItemGroupedTable({
  items,
  breakdownFor,
  adjust,
  hiddenLocations,
}: {
  items: PantryItemRow[];
  breakdownFor: BreakdownFor;
  adjust: Adjust;
  hiddenLocations: Set<string>;
}) {
  // Starts with every multi-location item already open — the review
  // comment that made this the answer for PER-268 — computed once from the
  // initial breakdowns, not recomputed as buckets change under editing.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of items) {
      if (activeBuckets(breakdownFor(item.id)).length > 1) {
        initial.add(item.id);
      }
    }
    return initial;
  });

  function toggle(itemId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const visibleItems = items.filter((item) =>
    involvedBuckets(breakdownFor(item.id)).some(
      (key) => !hiddenLocations.has(key),
    ),
  );

  return (
    <div className="overflow-x-auto sm:rounded-lg sm:border sm:border-zinc-200 dark:sm:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            <th className="px-2 py-2 font-medium text-zinc-600 sm:px-4 dark:text-zinc-400">
              Name
            </th>
            <th className="px-2 py-2 font-medium text-zinc-600 sm:px-4 dark:text-zinc-400">
              Amount
            </th>
            <th className="px-2 py-2 font-medium text-zinc-600 sm:px-4 dark:text-zinc-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item) => {
            const breakdown = breakdownFor(item.id);
            // The filter hides individual location sub-rows, not just
            // whole items — the bug fix. An item's total (below) still
            // reflects every location it actually holds, filtered or not;
            // only which breakdown rows are shown/editable here changes.
            const visibleBuckets = activeBuckets(breakdown).filter(
              ([key]) => !hiddenLocations.has(key),
            );
            const total = breakdownTotal(breakdown);
            const isMulti = visibleBuckets.length > 1;
            const isOpen = isMulti && expanded.has(item.id);
            const soleBucket = visibleBuckets[0]?.[0] ?? UNASSIGNED;

            return (
              <Fragment key={item.id}>
                <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-2 py-2 sm:px-4">
                    <div className="flex items-center gap-1">
                      {isMulti ? (
                        <button
                          type="button"
                          onClick={() => toggle(item.id)}
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
                    </div>
                  </td>
                  <td className="px-2 py-2 sm:px-4">
                    {formatQuantity(String(total), item.unit)}
                  </td>
                  <td className="px-2 py-2 sm:px-4">
                    <div className="flex items-center gap-1.5">
                      {isMulti ? (
                        <span className="px-1 text-xs text-zinc-500 dark:text-zinc-500">
                          {isOpen ? "Expanded below" : "Expand to adjust"}
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={total <= 0}
                            onClick={() => adjust(item.id, soleBucket, -1)}
                            aria-label={`Decrease ${item.name} quantity`}
                            className={ACTION_BUTTON_CLASS}
                          >
                            <MinusIcon className={ACTION_ICON_CLASS} />
                          </button>
                          <button
                            type="button"
                            onClick={() => adjust(item.id, soleBucket, 1)}
                            aria-label={`Increase ${item.name} quantity`}
                            className={ACTION_BUTTON_CLASS}
                          >
                            <PlusIcon className={ACTION_ICON_CLASS} />
                          </button>
                        </>
                      )}
                      <StubOverflowButton />
                    </div>
                  </td>
                </tr>
                {isOpen &&
                  visibleBuckets.map(([bucket, amount]) => (
                    <tr
                      key={`${item.id}-${bucket}`}
                      className="border-b border-zinc-100 bg-zinc-50/70 last:border-0 dark:border-zinc-900 dark:bg-zinc-900/40"
                    >
                      <td className="py-1.5 pr-2 pl-9 text-zinc-600 sm:pl-11 dark:text-zinc-400">
                        {bucket === UNASSIGNED ? "Unassigned" : bucket}
                      </td>
                      <td className="px-2 py-1.5 sm:px-4">
                        {formatQuantity(String(amount), item.unit)}
                      </td>
                      <td className="px-2 py-1.5 sm:px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={amount <= 0}
                            onClick={() => adjust(item.id, bucket, -1)}
                            aria-label={`Decrease ${item.name} quantity at ${bucket}`}
                            className={ACTION_BUTTON_CLASS}
                          >
                            <MinusIcon className={ACTION_ICON_CLASS} />
                          </button>
                          <button
                            type="button"
                            onClick={() => adjust(item.id, bucket, 1)}
                            aria-label={`Increase ${item.name} quantity at ${bucket}`}
                            className={ACTION_BUTTON_CLASS}
                          >
                            <PlusIcon className={ACTION_ICON_CLASS} />
                          </button>
                        </div>
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

function LocationGroupedTable({
  items,
  locations,
  breakdownFor,
  adjust,
  hiddenLocations,
}: {
  items: PantryItemRow[];
  locations: string[];
  breakdownFor: BreakdownFor;
  adjust: Adjust;
  hiddenLocations: Set<string>;
}) {
  const orderedKeys = [...locations, UNASSIGNED].filter(
    (key) => !hiddenLocations.has(key),
  );

  return (
    <div className="flex flex-col gap-6">
      {orderedKeys.map((key) => {
        const rows = items
          .map((item) => ({
            item,
            amount: breakdownFor(item.id)[key] ?? 0,
          }))
          .filter(({ amount }) => amount > 0);

        if (rows.length === 0) return null;

        return (
          <div key={key}>
            <h2 className="px-2 pb-2 text-sm font-semibold text-black sm:px-0 dark:text-zinc-50">
              {key === UNASSIGNED ? "Unassigned" : key}
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
                  {rows.map(({ item, amount }) => (
                    <tr
                      key={item.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <td className="px-2 py-2 sm:px-4">{item.name}</td>
                      <td className="px-2 py-2 sm:px-4">
                        {formatQuantity(String(amount), item.unit)}
                      </td>
                      <td className="px-2 py-2 sm:px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={amount <= 0}
                            onClick={() => adjust(item.id, key, -1)}
                            aria-label={`Decrease ${item.name} quantity at ${key === UNASSIGNED ? "Unassigned" : key}`}
                            className={ACTION_BUTTON_CLASS}
                          >
                            <MinusIcon className={ACTION_ICON_CLASS} />
                          </button>
                          <button
                            type="button"
                            onClick={() => adjust(item.id, key, 1)}
                            aria-label={`Increase ${item.name} quantity at ${key === UNASSIGNED ? "Unassigned" : key}`}
                            className={ACTION_BUTTON_CLASS}
                          >
                            <PlusIcon className={ACTION_ICON_CLASS} />
                          </button>
                        </div>
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
