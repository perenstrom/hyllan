import Link from "next/link";

import { AccountMenu } from "./account-menu";
import { MinusIcon, PencilIcon, PlusIcon, TrashIcon } from "./icons";
import { decrementItem, deleteItem, incrementItem } from "./items/actions";
import type { pantryItems } from "@/db/schema";
import { formatQuantity } from "@/lib/pantry-item";

type PantryItemRow = typeof pantryItems.$inferSelect;

type Props = {
  items: PantryItemRow[];
};

// 32px touch target per ADR 0004.
const ACTION_BUTTON_CLASS =
  "flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300";
const ACTION_ICON_CLASS = "h-4 w-4";

export function SignedInHome({ items }: Props) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <span className="font-semibold text-black dark:text-zinc-50">
          Hyllan
        </span>
        <AccountMenu />
      </header>
      <main className="flex flex-1 flex-col gap-4 px-6 py-6">
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

        {items.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-lg text-zinc-600 dark:text-zinc-400">
            Your pantry is empty.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[480px] text-left text-sm">
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
                {items.map((item) => {
                  const outOfStock = Number(item.quantity) === 0;
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${
                        outOfStock ? "text-zinc-400 dark:text-zinc-600" : ""
                      }`}
                    >
                      <td className="px-4 py-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                          <span>{item.name}</span>
                          {outOfStock && (
                            <span className="text-xs uppercase tracking-wide">
                              Out of stock
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {formatQuantity(item.quantity, item.unit)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <form action={decrementItem.bind(null, item.id)}>
                            <button
                              type="submit"
                              disabled={outOfStock}
                              aria-label={`Decrease ${item.name} quantity`}
                              className={ACTION_BUTTON_CLASS}
                            >
                              <MinusIcon className={ACTION_ICON_CLASS} />
                            </button>
                          </form>
                          <form action={incrementItem.bind(null, item.id)}>
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
