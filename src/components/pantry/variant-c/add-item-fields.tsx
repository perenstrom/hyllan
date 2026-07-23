"use client";

// PROTOTYPE (PER-218) — Variant C: shared add-item form fields with live merge preview.

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

export function AddItemFieldsC({
  existingItems,
  onSubmit,
}: {
  existingItems: PantryItem[];
  onSubmit: (result: { name: string; quantity: number; unit: Unit }) => void;
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
      className="flex flex-1 flex-col gap-4 px-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, quantity: parsedQty, unit });
        setName("");
        setQuantity("1");
        setUnit("count");
      }}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="c-name">Name</Label>
        <Input
          id="c-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rice"
          className="h-12 text-base"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="c-quantity">Quantity</Label>
          <Input
            id="c-quantity"
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="c-unit">Unit</Label>
          <Select
            value={unit}
            onValueChange={(v) => setUnit(v as Unit)}
            disabled={!!existing}
          >
            <SelectTrigger id="c-unit" className="h-12 w-full text-base">
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
      {name.trim() && (
        <p className="text-sm text-zinc-500">
          {existing
            ? `${existing.name} — ${existing.quantity + parsedQty} ${existing.unit} total after adding.`
            : `${name} — new item, ${parsedQty} ${unit}.`}
        </p>
      )}
      <Button type="submit" className="mt-auto h-12 text-base">
        {existing ? "Add to existing item" : "Add to pantry"}
      </Button>
    </form>
  );
}
