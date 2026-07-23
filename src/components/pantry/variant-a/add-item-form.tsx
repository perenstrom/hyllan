"use client";

// PROTOTYPE (PER-218) — Variant A: dense operator table, minimal add-item form.

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEED_ITEMS, UNITS, findByName, type Unit } from "@/lib/pantry";
import { TopBarA } from "./top-bar";
import type { VariantKey } from "@/lib/variant";

export function AddItemFormA({ variant }: { variant: VariantKey }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<Unit>("count");
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const existing = useMemo(() => findByName(SEED_ITEMS, name), [name]);
  const parsedQty = Number(quantity) || 0;

  return (
    <div className="flex flex-1 flex-col">
      <TopBarA variant={variant} />
      <div className="mx-auto w-full max-w-sm px-4 py-8">
        <h1 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Add item
        </h1>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmed(
              existing
                ? `Merged into "${existing.name}" — new total ${existing.quantity + parsedQty} ${existing.unit}.`
                : `Added "${name}" — ${parsedQty} ${unit}.`,
            );
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rice"
              required
            />
            {existing && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Already have {existing.quantity} {existing.unit} — this will
                add to it.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={0}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="unit">Unit</Label>
              <Select
                value={unit}
                onValueChange={(v) => setUnit(v as Unit)}
                disabled={!!existing}
              >
                <SelectTrigger id="unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="mt-2">
            {existing ? "Add to existing item" : "Add to pantry"}
          </Button>
        </form>
        {confirmed && (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {confirmed}
          </p>
        )}
      </div>
    </div>
  );
}
