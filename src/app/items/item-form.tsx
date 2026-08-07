"use client";

import Link from "next/link";
import { useActionState } from "react";

import { PANTRY_ITEM_UNITS } from "@/lib/pantry-item";
import type { PantryItemUnit } from "@/lib/pantry-item";

export type ItemFormState = { error: string } | undefined;

type ItemFormAction = (
  prevState: ItemFormState,
  formData: FormData,
) => Promise<ItemFormState>;

type ItemFormDefaultValues = {
  name: string;
  quantity: string;
  unit: PantryItemUnit;
  minimumQuantity: string | null;
};

type Props = {
  heading: string;
  action: ItemFormAction;
  submitLabel: string;
  pendingLabel: string;
  defaultValues?: ItemFormDefaultValues;
};

// Shared by the add and edit item pages (ADR 0004: "edit opens the same
// focused form") — only the heading, bound action, and prefilled values
// differ between the two.
export function ItemForm({
  heading,
  action,
  submitLabel,
  pendingLabel,
  defaultValues,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          {heading}
        </h1>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="name"
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={defaultValues?.name}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor="quantity"
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              Quantity
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="0"
              step="any"
              defaultValue={defaultValues?.quantity ?? "1"}
              required
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor="unit"
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              Unit
            </label>
            <select
              id="unit"
              name="unit"
              defaultValue={defaultValues?.unit ?? "count"}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {PANTRY_ITEM_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="minimumQuantity"
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            Minimum quantity (optional)
          </label>
          <input
            id="minimumQuantity"
            name="minimumQuantity"
            type="number"
            min="0"
            step="any"
            defaultValue={defaultValues?.minimumQuantity ?? ""}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Same unit as quantity. Leave blank to turn off low-stock tracking
            for this item.
          </p>
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {pending ? pendingLabel : submitLabel}
        </button>

        <Link
          href="/"
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          Cancel
        </Link>
      </form>
    </div>
  );
}
