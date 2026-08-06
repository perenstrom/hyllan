"use client";

import Link from "next/link";
import { useOptimistic } from "react";

import { AppHeader } from "./app-header";
import { MinusIcon, PencilIcon, PlusIcon, TrashIcon } from "./icons";
import { decrementItem, deleteItem, incrementItem } from "./items/actions";
import type { pantryItems } from "@/db/schema";
import {
  decrementQuantity,
  formatQuantity,
  incrementQuantity,
} from "@/lib/pantry-item";

type PantryItemRow = typeof pantryItems.$inferSelect;

type Props = {
  items: PantryItemRow[];
};

type QuantityUpdate = { itemId: string; type: "increment" | "decrement" };

// Mirrors the server's clamp (PER-226) so the optimistic value never
// predicts a decrement below zero that the server would then correct.
function applyQuantityUpdate(
  items: PantryItemRow[],
  update: QuantityUpdate,
): PantryItemRow[] {
  return items.map((item) =>
    item.id === update.itemId
      ? {
          ...item,
          quantity:
            update.type === "increment"
              ? incrementQuantity(item.quantity)
              : decrementQuantity(item.quantity),
        }
      : item,
  );
}

// 32px touch target per ADR 0004.
const ACTION_BUTTON_CLASS =
  "flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300";
const ACTION_ICON_CLASS = "h-4 w-4";

// Red tint, chosen over the page background alone (ADR 0004, PER-236) so
// out-of-stock rows are distinguishable without a mounting/unmounting label
// that would shift layout. zinc-600/zinc-300 replaces the prior
// zinc-400/zinc-600 muted text, which had the shades swapped and failed
// WCAG AA contrast against the plain background.
const OUT_OF_STOCK_ROW_CLASS =
  "bg-red-100 text-zinc-600 dark:bg-red-950 dark:text-zinc-300";

export function SignedInHome({ items }: Props) {
  const [optimisticItems, addOptimisticUpdate] = useOptimistic(
    items,
    applyQuantityUpdate,
  );

  async function handleIncrement(itemId: string) {
    addOptimisticUpdate({ itemId, type: "increment" });
    await incrementItem(itemId);
  }

  async function handleDecrement(itemId: string) {
    addOptimisticUpdate({ itemId, type: "decrement" });
    await decrementItem(itemId);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-4 px-2 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
            Your pantry
          </h1>
          <Link
            href="/items/new"
            className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
          >
            + Add item
          </Link>
        </div>

        {optimisticItems.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-lg text-zinc-600 dark:text-zinc-400">
            Your pantry is empty.
          </p>
        ) : (
          <div className="overflow-x-auto sm:rounded-lg sm:border sm:border-zinc-200 dark:sm:border-zinc-800">
            {/* 320px leaves room within a 375px viewport once `main`'s
                mobile px-2 (16px total) is subtracted, so the 2x2 actions
                grid (PER-233) doesn't push ordinary phone widths into
                scroll — only genuine edge cases like very long item names
                do. */}
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                    Name
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
                {optimisticItems.map((item) => {
                  const outOfStock = Number(item.quantity) === 0;
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${
                        outOfStock ? OUT_OF_STOCK_ROW_CLASS : ""
                      }`}
                    >
                      <td className="px-4 py-2">
                        {item.name}
                        {outOfStock && (
                          <span className="sr-only"> Out of stock</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {formatQuantity(item.quantity, item.unit)}
                      </td>
                      <td className="px-4 py-2">
                        {/* 2x2 grid below sm (ADR 0004, PER-233) so the four
                            buttons' combined width stops being the table's
                            widest column and forcing horizontal scroll. */}
                        <div className="grid grid-cols-2 items-center gap-1.5 sm:flex">
                          <form action={handleDecrement.bind(null, item.id)}>
                            <button
                              type="submit"
                              disabled={outOfStock}
                              aria-label={`Decrease ${item.name} quantity`}
                              className={ACTION_BUTTON_CLASS}
                            >
                              <MinusIcon className={ACTION_ICON_CLASS} />
                            </button>
                          </form>
                          <form action={handleIncrement.bind(null, item.id)}>
                            <button
                              type="submit"
                              aria-label={`Increase ${item.name} quantity`}
                              className={ACTION_BUTTON_CLASS}
                            >
                              <PlusIcon className={ACTION_ICON_CLASS} />
                            </button>
                          </form>
                          <Link
                            href={`/items/${item.id}/edit`}
                            aria-label={`Edit ${item.name}`}
                            className={ACTION_BUTTON_CLASS}
                          >
                            <PencilIcon className={ACTION_ICON_CLASS} />
                          </Link>
                          <form action={deleteItem.bind(null, item.id)}>
                            <button
                              type="submit"
                              aria-label={`Delete ${item.name}`}
                              className={ACTION_BUTTON_CLASS}
                            >
                              <TrashIcon className={ACTION_ICON_CLASS} />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
