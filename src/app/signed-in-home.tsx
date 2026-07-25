import Link from "next/link";

import { AccountMenu } from "./account-menu";
import type { pantryItems } from "@/db/schema";
import { formatQuantity } from "@/lib/pantry-item";

type PantryItemRow = typeof pantryItems.$inferSelect;

type Props = {
  items: PantryItemRow[];
};

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
                      <td className="px-4 py-2" />
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
