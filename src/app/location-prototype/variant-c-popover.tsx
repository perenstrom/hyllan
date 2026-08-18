"use client";

// PROTOTYPE — wipe me. Variant C for PER-268: the table is pixel-identical
// to today's — no chevron, no navigation, no new column. The Amount cell
// becomes a button; for a multi-location item it opens a small popover
// right there with the per-location breakdown, editable inline. A
// multi-location item's row-level +/- also open the popover instead of
// guessing which location to touch. Single-bucket items are untouched:
// direct +/- on the row, plain (non-interactive) Amount text.

import * as Popover from "@radix-ui/react-popover";

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

export function VariantC({ items }: { items: PantryItemRow[] }) {
  const {
    locations,
    breakdownFor,
    adjust,
    addLocation,
    hiddenLocations,
    toggleLocationVisibility,
  } = usePrototypeLocationState(items);
  const visibleItems = items.filter((item) =>
    involvedBuckets(breakdownFor(item.id)).some(
      (key) => !hiddenLocations.has(key),
    ),
  );

  return (
    <main className="flex flex-1 flex-col gap-4 py-5 sm:px-6 sm:py-6">
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
                  <td className="px-2 py-2 sm:px-4">{item.name}</td>
                  <td className="px-2 py-2 sm:px-4">
                    {isMulti ? (
                      <BreakdownPopover
                        itemName={item.name}
                        unit={item.unit}
                        breakdown={breakdown}
                        onAdjust={(bucket, delta) =>
                          adjust(item.id, bucket, delta)
                        }
                        trigger={
                          <button
                            type="button"
                            className="rounded border border-dotted border-zinc-400 px-1.5 py-0.5 underline decoration-dotted underline-offset-2"
                          >
                            {formatQuantity(String(total), item.unit)}
                          </button>
                        }
                      />
                    ) : (
                      formatQuantity(String(total), item.unit)
                    )}
                  </td>
                  <td className="px-2 py-2 sm:px-4">
                    <div className="flex items-center gap-1.5">
                      {isMulti ? (
                        <BreakdownPopover
                          itemName={item.name}
                          unit={item.unit}
                          breakdown={breakdown}
                          onAdjust={(bucket, delta) =>
                            adjust(item.id, bucket, delta)
                          }
                          trigger={
                            <button
                              type="button"
                              aria-label={`Adjust ${item.name} by location`}
                              className={ACTION_BUTTON_CLASS}
                            >
                              <MinusIcon className={ACTION_ICON_CLASS} />
                            </button>
                          }
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={total <= 0}
                          onClick={() => adjust(item.id, soleBucket, -1)}
                          aria-label={`Decrease ${item.name} quantity`}
                          className={ACTION_BUTTON_CLASS}
                        >
                          <MinusIcon className={ACTION_ICON_CLASS} />
                        </button>
                      )}
                      {isMulti ? (
                        <BreakdownPopover
                          itemName={item.name}
                          unit={item.unit}
                          breakdown={breakdown}
                          onAdjust={(bucket, delta) =>
                            adjust(item.id, bucket, delta)
                          }
                          trigger={
                            <button
                              type="button"
                              aria-label={`Adjust ${item.name} by location`}
                              className={ACTION_BUTTON_CLASS}
                            >
                              <PlusIcon className={ACTION_ICON_CLASS} />
                            </button>
                          }
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => adjust(item.id, soleBucket, 1)}
                          aria-label={`Increase ${item.name} quantity`}
                          className={ACTION_BUTTON_CLASS}
                        >
                          <PlusIcon className={ACTION_ICON_CLASS} />
                        </button>
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
    </main>
  );
}

function BreakdownPopover({
  itemName,
  unit,
  breakdown,
  onAdjust,
  trigger,
}: {
  itemName: string;
  unit: PantryItemRow["unit"];
  breakdown: LocationBreakdown;
  onAdjust: (bucket: string, delta: number) => void;
  trigger: React.ReactNode;
}) {
  const buckets = activeBuckets(breakdown);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="z-10 w-56 rounded-lg border border-zinc-200 bg-white p-2 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="px-1 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-500">
            {itemName} by location
          </p>
          <ul className="flex flex-col gap-1">
            {buckets.map(([bucket, amount]) => (
              <li
                key={bucket}
                className="flex items-center justify-between gap-2 rounded px-1 py-1"
              >
                <span className="text-zinc-700 dark:text-zinc-300">
                  {bucket === UNASSIGNED ? "Unassigned" : bucket}
                </span>
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
                  <span className="w-14 text-center">
                    {formatQuantity(String(amount), unit)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAdjust(bucket, 1)}
                    aria-label={`Increase quantity at ${bucket}`}
                    className={ACTION_BUTTON_CLASS}
                  >
                    <PlusIcon className={ACTION_ICON_CLASS} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
