"use client";

import { useEffect, useRef, useState } from "react";

import { ItemPickerCombobox } from "./item-picker-combobox";
import {
  STOCK_TAKE_DIALOG_CLASS,
  StockTakeDialogHeader,
} from "./stock-take-dialog-header";
import { StockTakeQuantityField } from "./stock-take-quantity-field";
import type { LocationOption } from "@/lib/location";
import { quantityAtLocation } from "@/lib/location";
import type { PantryItemWithLocations } from "@/lib/pantry-items";

type Props = {
  location: LocationOption;
  items: PantryItemWithLocations[];
  onClose: () => void;
};

// Shelf-to-stock (CONTEXT.md "Stock take", PER-265): a standalone lookup
// over every pantry item in the household — unfiltered, so it works
// equally well for something never recorded at this Location and for a
// quick correction to something already tracked. Saves on blur the same
// way as the stock-to-shelf walkthrough, then resets to no item selected
// (never defaulting to the alphabetically-first item) so the next lookup
// is always a deliberate pick — but only on a blurred edit, not on a
// stepper tap: resetting on every tap would unmount the field (it's keyed
// on the selected item) after the very first nudge, making repeated
// taps to reach a value impossible.
export function ShelfToStockDialog({ location, items, onClose }: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [pickerResetKey, setPickerResetKey] = useState(0);
  const [savedQuantities, setSavedQuantities] = useState<
    Record<string, string>
  >({});
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

  function currentQuantity(item: PantryItemWithLocations) {
    return (
      savedQuantities[item.id] ?? quantityAtLocation(item.buckets, location.id)
    );
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={`${STOCK_TAKE_DIALOG_CLASS} max-w-lg`}
    >
      <StockTakeDialogHeader
        title={`Look up an item: ${location.name}`}
        onClose={() => dialogRef.current?.close()}
      />

      <div className="mt-4 flex flex-col gap-3">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No pantry items yet — add one first.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="shelf-to-stock-item"
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              Item
            </label>
            <ItemPickerCombobox
              key={pickerResetKey}
              id="shelf-to-stock-item"
              items={items}
              value={selectedItemId}
              onChange={setSelectedItemId}
            />
          </div>
        )}

        {selectedItem && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="shelf-to-stock-quantity"
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              Quantity at {location.name}
            </label>
            <StockTakeQuantityField
              key={selectedItem.id}
              id="shelf-to-stock-quantity"
              itemId={selectedItem.id}
              locationId={location.id}
              unit={selectedItem.unit}
              savedQuantity={currentQuantity(selectedItem)}
              onSaved={(quantity, source) => {
                setSavedQuantities((previous) => ({
                  ...previous,
                  [selectedItem.id]: quantity,
                }));
                if (source === "blur") {
                  setSelectedItemId(null);
                  setPickerResetKey((key) => key + 1);
                }
              }}
            />
          </div>
        )}
      </div>
    </dialog>
  );
}
