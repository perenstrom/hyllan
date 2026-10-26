"use client";

import { useId, useState, useTransition } from "react";

import { updateItemRegistrationQuantityPerScan } from "./registration-actions";
import { RemoveRegistrationDialog } from "./remove-registration-dialog";
import { OpenFoodFactsCredit } from "@/app/open-food-facts-credit";
import { PANEL_CARD_CLASS } from "@/app/panel-styles";
import { displayBarcodeValue } from "@/lib/barcode";
import type { ItemBarcodeRegistration } from "@/lib/barcode-registrations";
import {
  amountSuffixLabel,
  formatQuantity,
  parseQuantityPerScan,
  type PantryItemUnit,
} from "@/lib/pantry-item";

type Props = {
  unit: PantryItemUnit;
  registrations: ItemBarcodeRegistration[];
};

// The edit-item page's Barcodes section (PER-328): an item's Barcode
// registrations (ADR 0007), each removed or re-amounted on its own server
// action rather than through the item form's Save. Registering stays in
// batch scanning. The unit is the item's as currently saved — Unit is
// display-only, so a changed unit just relabels the stored amounts.
export function ItemRegistrations({ unit, registrations }: Props) {
  const [removing, setRemoving] = useState<ItemBarcodeRegistration | null>(
    null,
  );

  return (
    <section className={PANEL_CARD_CLASS} aria-labelledby="barcodes-heading">
      <h2
        id="barcodes-heading"
        className="text-lg font-semibold text-black dark:text-zinc-50"
      >
        Barcodes
      </h2>
      {registrations.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No barcodes yet. Scan this item in batch entry to register one.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {registrations.map((registration) => (
            <RegistrationRow
              key={registration.id}
              registration={registration}
              unit={unit}
              onRemove={() => setRemoving(registration)}
            />
          ))}
        </ul>
      )}
      {removing && (
        <RemoveRegistrationDialog
          registrationId={removing.id}
          digits={displayBarcodeValue(
            removing.barcodeValue,
            removing.symbology,
          )}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  );
}

type RowProps = {
  registration: ItemBarcodeRegistration;
  unit: PantryItemUnit;
  onRemove: () => void;
};

function RegistrationRow({ registration, unit, onRemove }: RowProps) {
  const amountId = useId();
  const digits = displayBarcodeValue(
    registration.barcodeValue,
    registration.symbology,
  );
  const [editing, setEditing] = useState(false);
  const [quantityPerScan, setQuantityPerScan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEditing() {
    setQuantityPerScan(Number(registration.quantityPerScan).toString());
    setError(null);
    setEditing(true);
  }

  // Checked here as well as on the server, so a bad amount never leaves
  // the field.
  function save() {
    const parsed = parseQuantityPerScan(quantityPerScan);
    if (parsed === null) {
      setError("Amount must be a positive number.");
      return;
    }
    startTransition(async () => {
      const result = await updateItemRegistrationQuantityPerScan(
        registration.id,
        parsed,
      );
      if (result.ok) {
        setEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <li className="flex flex-col gap-1 py-3 text-sm first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-zinc-900 dark:text-zinc-100">{digits}</p>
          {registration.productName && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <span>{registration.productName.name}</span>
              {registration.productName.source === "open_food_facts" && (
                <>
                  {" · "}
                  <OpenFoodFactsCredit />
                </>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove barcode ${digits}`}
          className="-my-2 shrink-0 py-2 text-xs text-zinc-600 underline dark:text-zinc-400"
        >
          Remove
        </button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={amountId} className="sr-only">
            Amount per scan for {digits}
          </label>
          <div className="flex items-center gap-2">
            <input
              id={amountId}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              enterKeyHint="done"
              value={quantityPerScan}
              onChange={(event) => setQuantityPerScan(event.target.value)}
              onFocus={(event) => event.target.select()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  save();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setEditing(false);
                }
              }}
              autoFocus
              className="h-11 w-full min-w-0 rounded border border-zinc-300 bg-white px-3 sm:h-9 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <span className="shrink-0 text-zinc-600 dark:text-zinc-400">
              {amountSuffixLabel(unit)} per scan
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="h-11 rounded bg-black px-3 text-sm font-medium text-white disabled:opacity-50 sm:h-8 dark:bg-zinc-50 dark:text-black"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="h-11 rounded border border-zinc-300 px-3 text-sm text-zinc-700 sm:h-8 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Edit amount for ${digits}`}
          className="-my-1 self-start py-1 text-zinc-700 underline decoration-dotted underline-offset-4 dark:text-zinc-300"
        >
          +{formatQuantity(registration.quantityPerScan, unit)} per scan
        </button>
      )}
    </li>
  );
}
