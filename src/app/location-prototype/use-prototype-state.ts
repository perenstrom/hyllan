"use client";

// PROTOTYPE — wipe me. Shared in-memory state behind all three PER-268
// variants: the household's mock location list, and each item's mock
// per-location breakdown. Never wired to a server action — increments,
// renames, and deletes here only ever touch this component's own state.

import { useMemo, useState } from "react";

import { mockBreakdown, UNASSIGNED, type LocationBreakdown } from "./mock-data";
import { useLocationList } from "./use-location-list";
import type { pantryItems } from "@/db/schema";

type PantryItemRow = typeof pantryItems.$inferSelect;

export function usePrototypeLocationState(items: PantryItemRow[]) {
  // Shared with the standalone manage page (manage/page.tsx) via
  // localStorage — rename/delete/create now happen there or in the
  // add-item picker, not on this hook (see PrototypeHeader).
  const { locations, addLocation } = useLocationList();
  const [breakdowns, setBreakdowns] = useState<
    Record<string, LocationBreakdown>
  >(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        mockBreakdown(item.id, Number(item.quantity), locations),
      ]),
    ),
  );

  // Locations hidden from the item list by the header's location filter
  // (2026-08-18 review: creation moved to the add-item picker, so the
  // header dropdown is filter-only — see PrototypeHeader). A location not
  // in this set is visible, so newly added locations default to shown
  // without needing to sync anything here.
  const [hiddenLocations, setHiddenLocations] = useState<Set<string>>(
    new Set(),
  );

  const breakdownFor = useMemo(
    () => (itemId: string) => breakdowns[itemId] ?? { [UNASSIGNED]: 0 },
    [breakdowns],
  );

  function adjust(itemId: string, bucket: string, delta: number) {
    setBreakdowns((current) => {
      const breakdown = current[itemId] ?? { [UNASSIGNED]: 0 };
      const next = Math.max(0, (breakdown[bucket] ?? 0) + delta);
      return { ...current, [itemId]: { ...breakdown, [bucket]: next } };
    });
  }

  function toggleLocationVisibility(key: string) {
    setHiddenLocations((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return {
    locations,
    breakdownFor,
    adjust,
    addLocation,
    hiddenLocations,
    toggleLocationVisibility,
  };
}
