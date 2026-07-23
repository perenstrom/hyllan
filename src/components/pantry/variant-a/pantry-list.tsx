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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEED_ITEMS } from "@/lib/pantry";
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
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-40">Quantity</TableHead>
              <TableHead className="w-24">Unit</TableHead>
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
                    {item.name}
                    {outOfStock && (
                      <span className="ml-2 text-xs font-normal uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                        Out of stock
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        onClick={() => bump(item.id, -1)}
                        aria-label={`Decrease ${item.name}`}
                      >
                        −
                      </Button>
                      <span className="w-10 text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        onClick={() => bump(item.id, 1)}
                        aria-label={`Increase ${item.name}`}
                      >
                        +
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {item.unit}
                    </Badge>
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
