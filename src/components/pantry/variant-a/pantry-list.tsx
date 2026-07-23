"use client";

// PROTOTYPE (PER-218) — Variant A: dense operator table.

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatAmount, SEED_ITEMS } from "@/lib/pantry";
import { TopBarA } from "./top-bar";
import type { VariantKey } from "@/lib/variant";

export function PantryListA({ variant }: { variant: VariantKey }) {
  const [items, setItems] = useState(SEED_ITEMS);

  function bump(id: string, delta: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item,
      ),
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBarA variant={variant} />
      <div className="mx-auto w-full max-w-3xl px-2 py-4 sm:px-4 sm:py-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[88px] text-right sm:w-28">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const outOfStock = item.quantity === 0;
              return (
                <TableRow
                  key={item.id}
                  className={outOfStock ? "text-zinc-400 dark:text-zinc-600" : undefined}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                      <span>{item.name}</span>
                      {outOfStock && (
                        <span className="text-xs font-normal uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                          Out of stock
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(item.quantity, item.unit)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => bump(item.id, -1)}
                        aria-label={`Decrease ${item.name}`}
                      >
                        −
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => bump(item.id, 1)}
                        aria-label={`Increase ${item.name}`}
                      >
                        +
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
