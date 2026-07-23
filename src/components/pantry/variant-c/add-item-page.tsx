"use client";

// PROTOTYPE (PER-218) — Variant C: full-page add-item fallback route.

import { useState } from "react";
import { SEED_ITEMS } from "@/lib/pantry";
import { AddItemFieldsC } from "./add-item-fields";
import { MobileShellC } from "./mobile-shell";

export function AddItemPageC() {
  const [confirmed, setConfirmed] = useState<string | null>(null);

  return (
    <MobileShellC>
      <h1 className="px-4 pt-4 text-lg font-semibold tracking-tight">
        Add item
      </h1>
      <AddItemFieldsC
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
        <p className="mx-4 mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {confirmed}
        </p>
      )}
    </MobileShellC>
  );
}
