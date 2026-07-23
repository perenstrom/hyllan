"use client";

// PROTOTYPE (PER-218) — Variant C: mobile-first list + FAB.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SEED_ITEMS, findByName } from "@/lib/pantry";
import { AddItemFieldsC } from "./add-item-fields";
import { MobileShellC } from "./mobile-shell";

export function PantryListC() {
  const [items, setItems] = useState(SEED_ITEMS);
  const [addOpen, setAddOpen] = useState(false);
  const [outOfStockOpen, setOutOfStockOpen] = useState(false);

  const inStock = items.filter((item) => item.quantity > 0);
  const outOfStock = items.filter((item) => item.quantity === 0);

  function handleAdd({
    name,
    quantity,
    unit,
  }: {
    name: string;
    quantity: number;
    unit: (typeof items)[number]["unit"];
  }) {
    setItems((prev) => {
      const existing = findByName(prev, name);
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [...prev, { id: crypto.randomUUID(), name, quantity, unit }];
    });
    setAddOpen(false);
  }

  return (
    <MobileShellC>
      <div className="relative flex flex-1 flex-col">
        <ul className="flex-1 divide-y divide-zinc-200 dark:divide-zinc-800">
          {inStock.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between px-4 py-4 active:bg-zinc-50 dark:active:bg-zinc-900"
            >
              <span className="text-base font-medium">{item.name}</span>
              <span className="text-right">
                <span className="block text-lg font-semibold tabular-nums">
                  {item.quantity}
                </span>
                <span className="block text-xs text-zinc-500">
                  {item.unit}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {outOfStock.length > 0 && (
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setOutOfStockOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm text-zinc-500"
            >
              <span>Out of stock ({outOfStock.length})</span>
              <span>{outOfStockOpen ? "▲" : "▼"}</span>
            </button>
            {outOfStockOpen && (
              <ul className="divide-y divide-zinc-200 pb-4 dark:divide-zinc-800">
                {outOfStock.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between px-4 py-3 text-zinc-400 dark:text-zinc-600"
                  >
                    <span>{item.name}</span>
                    <span className="text-xs">{item.unit}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Button
          size="icon"
          className="fixed right-6 bottom-6 h-14 w-14 rounded-full text-2xl shadow-lg"
          aria-label="Add item"
          onClick={() => setAddOpen(true)}
        >
          +
        </Button>

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetContent side="bottom" className="max-h-[80vh]">
            <SheetTitle className="px-4 pt-4">Add item</SheetTitle>
            <AddItemFieldsC existingItems={items} onSubmit={handleAdd} />
          </SheetContent>
        </Sheet>
      </div>
    </MobileShellC>
  );
}
