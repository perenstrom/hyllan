"use client";

// PROTOTYPE — wipe me. Variant B for PER-268: the table itself is
// untouched — still one row per item, no chevrons. Clicking a
// multi-location item's name (or its "View locations" action) swaps the
// whole main area for a full detail view of that one item, with a back
// link. Single-bucket items keep direct +/- on their row, same as today.

import { ChevronLeft } from "lucide-react";
import { useState } from "react";

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

export function VariantB({ items }: { items: PantryItemRow[] }) {
  const {
    locations,
    breakdownFor,
    adjust,
    addLocation,
    hiddenLocations,
    toggleLocationVisibility,
  } = usePrototypeLocationState(items);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const openItem = items.find((item) => item.id === openItemId) ?? null;
  const visibleItems = items.filter((item) =>
    involvedBuckets(breakdownFor(item.id)).some(
      (key) => !hiddenLocations.has(key),
    ),
  );

  return (
    <main className="flex flex-1 flex-col gap-4 py-5 sm:px-6 sm:py-6">
      {openItem ? (
        <ItemDetail
          item={openItem}
          breakdown={breakdownFor(openItem.id)}
          onAdjust={(bucket, delta) => adjust(openItem.id, bucket, delta)}
          onBack={() => setOpenItemId(null)}
        />
      ) : (
        <>
          <PrototypeHeader
            locations={locations}
            hiddenLocations={hiddenLocations}
            onToggleLocation={toggleLocationVisibility}
            onCreateLocation={addLocation}
          />
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
                  const buckets = activeBuckets(breakdown);
                  const total = breakdownTotal(breakdown);
                  const isMulti = buckets.length > 1;
                  const soleBucket = buckets[0]?.[0] ?? UNASSIGNED;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <td className="px-2 py-2 sm:px-4">
                        {isMulti ? (
                          <button
                            type="button"
                            onClick={() => setOpenItemId(item.id)}
                            className="underline decoration-dotted underline-offset-2"
                          >
                            {item.name}
                          </button>
                        ) : (
                          item.name
                        )}
                      </td>
                      <td className="px-2 py-2 sm:px-4">
                        {formatQuantity(String(total), item.unit)}
                      </td>
                      <td className="px-2 py-2 sm:px-4">
                        <div className="flex items-center gap-1.5">
                          {isMulti ? (
                            <button
                              type="button"
                              onClick={() => setOpenItemId(item.id)}
                              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                            >
                              View locations
                            </button>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function ItemDetail({
  item,
  breakdown,
  onAdjust,
  onBack,
}: {
  item: PantryItemRow;
  breakdown: LocationBreakdown;
  onAdjust: (bucket: string, delta: number) => void;
  onBack: () => void;
}) {
  const buckets = activeBuckets(breakdown);
  const total = breakdownTotal(breakdown);

  return (
    <div className="flex flex-col gap-4 px-2 sm:px-0">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400"
      >
        <ChevronLeft className="h-4 w-4" /> Back to pantry
      </button>
      <div>
        <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
          {item.name}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Total: {formatQuantity(String(total), item.unit)}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                Location
              </th>
              <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                Amount
              </th>
              <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {buckets.map(([bucket, amount]) => (
              <tr
                key={bucket}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
              >
                <td className="px-4 py-2">
                  {bucket === UNASSIGNED ? "Unassigned" : bucket}
                </td>
                <td className="px-4 py-2">
                  {formatQuantity(String(amount), item.unit)}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={amount <= 0}
                      onClick={() => onAdjust(bucket, -1)}
                      aria-label={`Decrease quantity at ${bucket}`}
                      className={ACTION_BUTTON_CLASS}
                    >
                      <MinusIcon className={ACTION_ICON_CLASS} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdjust(bucket, 1)}
                      aria-label={`Increase quantity at ${bucket}`}
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
}
