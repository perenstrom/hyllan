"use client";

import { useEffect, useRef, useState } from "react";

import {
  STOCK_TAKE_DIALOG_CLASS,
  StockTakeDialogHeader,
} from "./stock-take-dialog-header";
import { StockTakeQuantityField } from "./stock-take-quantity-field";
import type { LocationOption } from "@/lib/location";
import { pantryItemsAtLocation } from "@/lib/location";
import type { PantryItemWithLocations } from "@/lib/pantry-items";

type Props = {
  location: LocationOption;
  items: PantryItemWithLocations[];
  onClose: () => void;
};

// Stock-to-shelf (CONTEXT.md "Stock take", PER-265): a full-size,
// one-item-at-a-time walkthrough of every item currently nonzero at this
// Location, alphabetical, snapshotted once here via useState's lazy
// initializer so the list and its ordering stay fixed for the rest of the
// pass regardless of later prop changes. Each field saves on blur — leaving
// it unedited is an implicit confirmation, not a separate action — and
// reaching the last item's Finish simply closes the pass; there is no
// further step appended (an earlier draft that appended shelf-to-stock as a
// trailing step was prototyped and rejected, see the ticket's resolution
// comment).
export function StockToShelfDialog({ location, items, onClose }: Props) {
  const [snapshot] = useState(() => pantryItemsAtLocation(items, location.id));
  const [index, setIndex] = useState(0);
  const [savedQuantities, setSavedQuantities] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      snapshot.map((item) => [
        item.id,
        item.buckets.find((bucket) => bucket.locationId === location.id)
          ?.quantity ?? "0",
      ]),
    ),
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const current = snapshot[index];
  const isLast = index === snapshot.length - 1;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={`${STOCK_TAKE_DIALOG_CLASS} max-w-lg`}
    >
      <StockTakeDialogHeader
        title={`Stock take: ${location.name}`}
        onClose={() => dialogRef.current?.close()}
      />

      {snapshot.length === 0 || !current ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Nothing recorded at {location.name} yet.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Item {index + 1} of {snapshot.length}
          </p>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="stock-to-shelf-quantity"
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              {current.name}
            </label>
            <StockTakeQuantityField
              key={current.id}
              id="stock-to-shelf-quantity"
              itemId={current.id}
              locationId={location.id}
              unit={current.unit}
              savedQuantity={savedQuantities[current.id]}
              onSaved={(quantity) =>
                setSavedQuantities((previous) => ({
                  ...previous,
                  [current.id]: quantity,
                }))
              }
            />
          </div>

          <div className="mt-2 flex justify-between gap-2">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((current) => current - 1)}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => {
                if (isLast) {
                  dialogRef.current?.close();
                  return;
                }
                setIndex((current) => current + 1);
              }}
              className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
