"use client";

// PROTOTYPE (PER-218) — Variant B: shared add-item form fields (used in dialog and full page).

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
import { UNITS, findByName, type PantryItem, type Unit } from "@/lib/pantry";

export function AddItemFieldsB({
  existingItems,
  onSubmit,
  submitLabel = "Add item",
}: {
  existingItems: PantryItem[];
  onSubmit: (result: { name: string; quantity: number; unit: Unit }) => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<Unit>("count");

  const existing = useMemo(
    () => findByName(existingItems, name),
    [existingItems, name],
  );
  const parsedQty = Number(quantity) || 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, quantity: parsedQty, unit });
        setName("");
        setQuantity("1");
        setUnit("count");
      }}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="b-name">Name</Label>
        <Input
          id="b-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rice"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="b-quantity">Quantity</Label>
          <Input
            id="b-quantity"
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="b-unit">Unit</Label>
          <Select
            value={unit}
            onValueChange={(v) => setUnit(v as Unit)}
            disabled={!!existing}
          >
            <SelectTrigger id="b-unit" className="w-full">
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
      {existing && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          You already have {existing.name} ({existing.quantity}{" "}
          {existing.unit}) — this will add {parsedQty} {existing.unit}, for{" "}
          {existing.quantity + parsedQty} {existing.unit} total.
        </p>
      )}
      <Button type="submit">{existing ? "Add to existing item" : submitLabel}</Button>
    </form>
  );
}
