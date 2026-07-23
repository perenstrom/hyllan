"use client";

// PROTOTYPE (PER-218) — Variant B: card grid + modal.

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SEED_ITEMS, findByName } from "@/lib/pantry";
import { AddItemFieldsB } from "./add-item-fields";
import { ShellB } from "./shell";
import type { VariantKey } from "@/lib/variant";

export function PantryListB({ variant }: { variant: VariantKey }) {
  const [items, setItems] = useState(SEED_ITEMS);
  const [open, setOpen] = useState(false);

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
      return [
        ...prev,
        { id: crypto.randomUUID(), name, quantity, unit },
      ];
    });
    setOpen(false);
  }

  return (
    <ShellB variant={variant}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Your pantry</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>+ Add item</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add item</DialogTitle>
            </DialogHeader>
            <AddItemFieldsB existingItems={items} onSubmit={handleAdd} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const outOfStock = item.quantity === 0;
          return (
            <Card
              key={item.id}
              className={outOfStock ? "opacity-50" : undefined}
            >
              <CardHeader>
                <CardTitle className="text-base">{item.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                {outOfStock ? (
                  <Badge variant="secondary">Out of stock</Badge>
                ) : (
                  <Badge>
                    {item.quantity} {item.unit}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ShellB>
  );
}
