"use client";

import { useState, useTransition } from "react";

import { setStockTakeQuantity } from "./actions";
import { ACTION_BUTTON_BASE_CLASS } from "@/app/action-button";
import { MinusIcon, PlusIcon } from "@/app/icons";
import { parseQuantity } from "@/lib/pantry-item";
import type { PantryItemUnit } from "@/lib/pantry-item";

// Distinguishes a stepper tap from a typed-then-blurred edit, so a caller
// (ShelfToStockDialog) can tell "still adjusting this item" apart from
// "done with it" — see the type's use below.
export type QuantityCommitSource = "blur" | "stepper";

type Props = {
  id?: string;
  itemId: string;
  locationId: string;
  unit: PantryItemUnit;
  savedQuantity: string;
  onSaved: (quantity: string, source: QuantityCommitSource) => void;
};

// Tap increment for the +/- stepper (PER-265, Linear resolution comment on
// "Taking stock" — validated on the throwaway `prototype/per-265-taking-
// stock-flows` branch, never merged to main): whole units for count-like
// units, finer steps for weight/volume so a single tap doesn't overshoot.
const STEP_BY_UNIT: Partial<Record<PantryItemUnit, number>> = {
  kg: 0.5,
  l: 0.1,
  g: 50,
  ml: 50,
};

function stepFor(unit: PantryItemUnit): number {
  return STEP_BY_UNIT[unit] ?? 1;
}

// Rounds to 2 decimal places to absorb float drift from repeated fractional
// steps (e.g. 0.1 + 0.1 !== 0.2) before it reaches parseQuantity's pattern.
function round(quantity: number): number {
  return Math.round(quantity * 100) / 100;
}

// Larger than the Actions column's 32px controls (ADR 0004) — a deliberate
// touch-target bump for this full-size modal, per the prototype resolution
// comment's "large +/- steppers".
const STEPPER_BUTTON_CLASS = `${ACTION_BUTTON_BASE_CLASS} h-12 w-12 shrink-0`;

// The quantity field shared by both stock take flows (PER-265, CONTEXT.md
// "Stock take"): pre-filled with the current recorded amount, saves
// immediately — on blur for a typed edit, or on tap for a stepper button —
// only when the value actually changed; leaving it unedited is an implicit
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
  const [value, setValue] = useState(savedQuantity);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function commit(raw: string, source: QuantityCommitSource) {
    const parsed = parseQuantity(raw);
    if (parsed === null) {
      setError("Quantity must be zero or a positive number.");
      return;
    }
    setError(null);
    setValue(parsed);
    if (parsed === savedQuantity) {
      return;
    }
    startTransition(async () => {
      const result = await setStockTakeQuantity(itemId, locationId, parsed);
      if (result.ok) {
        onSaved(result.quantity, source);
      } else {
        setError(result.error);
      }
    });
  }

  function step(direction: 1 | -1) {
    // Falls back to the last saved amount, not zero, when the field
    // currently holds invalid mid-edit text (e.g. a trailing "2.") — a tap
    // continues from what's actually recorded rather than discarding it.
    const base =
      parseQuantity(value) !== null ? Number(value) : Number(savedQuantity);
    const next = Math.max(0, round(base + direction * stepFor(unit)));
    commit(next.toString(), "stepper");
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={Number(value) <= 0}
          onClick={() => step(-1)}
          className={STEPPER_BUTTON_CLASS}
        >
          <MinusIcon className="h-5 w-5" />
        </button>
        <input
          id={id}
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={(event) => commit(event.target.value, "blur")}
          className="h-12 w-full min-w-0 rounded border border-zinc-300 px-3 text-center dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => step(1)}
          className={STEPPER_BUTTON_CLASS}
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>
      <span className="text-center text-sm text-zinc-500 dark:text-zinc-500">
        {unit}
      </span>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
