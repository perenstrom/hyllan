"use client";

import { useState, useTransition } from "react";

import { setStockTakeQuantity } from "./actions";
import { parseQuantity } from "@/lib/pantry-item";
import type { PantryItemUnit } from "@/lib/pantry-item";

type Props = {
  id?: string;
  itemId: string;
  locationId: string;
  unit: PantryItemUnit;
  savedQuantity: string;
  onSaved: (quantity: string) => void;
};

// The quantity field shared by both stock take flows (PER-265, CONTEXT.md
// "Stock take"): pre-filled with the current recorded amount, saves on blur
// only when the value actually changed — leaving it unedited is an implicit
// confirmation, not a separate action. Owns its own error state so a stale
// validation message can never bleed from one item/selection to the next:
// the parent remounts this component (via `key={itemId}`) whenever the
// item being edited changes, which resets that state for free
// (CODING_STANDARDS.md: resetting state on a prop change is a job for the
// `key` prop, not an Effect) rather than the parent having to clear it from
// every navigation/selection handler — which previously raced blur's own
// error-setting and silently discarded it before it ever rendered.
export function StockTakeQuantityField({
  id,
  itemId,
  locationId,
  unit,
  savedQuantity,
  onSaved,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleBlur(raw: string) {
    const parsed = parseQuantity(raw);
    if (parsed === null) {
      setError("Quantity must be zero or a positive number.");
      return;
    }
    setError(null);
    if (parsed === savedQuantity) {
      return;
    }
    startTransition(async () => {
      const result = await setStockTakeQuantity(itemId, locationId, parsed);
      if (result.ok) {
        onSaved(result.quantity);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          min="0"
          step="any"
          defaultValue={savedQuantity}
          onBlur={(event) => handleBlur(event.target.value)}
          className="h-10 w-full rounded border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <span className="text-sm text-zinc-500 dark:text-zinc-500">{unit}</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
