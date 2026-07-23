"use client";

// PROTOTYPE (PER-218) — Variant B: full-page add-item fallback route.

import { useState } from "react";
import { SEED_ITEMS } from "@/lib/pantry";
import { AddItemFieldsB } from "./add-item-fields";
import { ShellB } from "./shell";
import type { VariantKey } from "@/lib/variant";

export function AddItemFormB({ variant }: { variant: VariantKey }) {
  const [confirmed, setConfirmed] = useState<string | null>(null);

  return (
    <ShellB variant={variant}>
      <h1 className="mb-6 text-lg font-semibold tracking-tight">Add item</h1>
      <div className="max-w-sm">
        <AddItemFieldsB
          existingItems={SEED_ITEMS}
          onSubmit={({ name, quantity, unit }) => {
            const existing = SEED_ITEMS.find(
              (i) => i.name.toLowerCase() === name.trim().toLowerCase(),
            );
            setConfirmed(
              existing
                ? `Merged into "${existing.name}" — new total ${existing.quantity + quantity} ${existing.unit}.`
                : `Added "${name}" — ${quantity} ${unit}.`,
            );
          }}
        />
        {confirmed && (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {confirmed}
          </p>
        )}
      </div>
    </ShellB>
  );
}
