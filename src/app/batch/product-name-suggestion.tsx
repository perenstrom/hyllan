"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { suggestScannedProductName } from "./scan-actions";
import { OpenFoodFactsCredit } from "@/app/open-food-facts-credit";
import type { ProductNameSuggestion } from "@/lib/product-names";

// "loading" while the background lookup is in flight; null once it settles
// on nothing (a miss is silent, ADR 0008) or the chip is dismissed.
export type SuggestionState = "loading" | ProductNameSuggestion | null;

// Looks a first scan's barcode up in the background (ADR 0008). `enabled`
// is off for "Wrong item?", whose barcode already has an item name.
export function useProductNameSuggestion(
  barcodeValue: string,
  enabled: boolean,
) {
  const [suggestion, setSuggestion] = useState<SuggestionState>(
    enabled ? "loading" : null,
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    suggestScannedProductName(barcodeValue)
      .catch(() => null)
      .then((found) => {
        if (!cancelled) {
          setSuggestion(found);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [barcodeValue, enabled]);

  return { suggestion, dismiss: () => setSuggestion(null) };
}

type Props = {
  suggestion: SuggestionState;
  onUse: (name: string) => void;
  onDismiss: () => void;
};

// The suggestion slot under the item field: a brief "Looking up" note, then
// a chip that copies the name in only when tapped — never written into the
// field on its own (ADR 0008) — with the "via Open Food Facts" credit its
// ODbL licence requires.
export function ProductNameSuggestionChip({
  suggestion,
  onUse,
  onDismiss,
}: Props) {
  if (suggestion === "loading") {
    return (
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        Looking up product…
      </p>
    );
  }
  if (!suggestion) {
    return null;
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <button
          type="button"
          onClick={() => onUse(suggestion.name)}
          aria-label={`Use suggested name ${suggestion.name}`}
          className="py-2 pr-1 pl-3 text-zinc-800 sm:py-1 dark:text-zinc-200"
        >
          {suggestion.name}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss suggestion"
          className="p-2 text-zinc-400 hover:text-zinc-600 sm:p-1.5 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </span>
      {suggestion.source === "open_food_facts" && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          <OpenFoodFactsCredit />
        </span>
      )}
    </div>
  );
}
