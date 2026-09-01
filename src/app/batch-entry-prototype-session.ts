"use client";

import { useReducer, useState } from "react";

import type { PantryItemUnit } from "@/lib/pantry-item";

// PER-278 prototype infrastructure — shared session/state logic behind all
// three variants (an in-memory reducer, not a layout, so sharing it doesn't
// flatten the variants into the anti-pattern UI.md warns against). No real
// mutation ever happens: this only ever touches its own local copy of the
// item list, never the server actions the real app/items list uses.

export type BatchDirection = "add" | "remove";

export type PrototypeItem = {
  id: string;
  name: string;
  unit: PantryItemUnit;
  quantity: number;
};

export type BatchEntry = {
  id: string;
  itemId: string;
  itemName: string;
  unit: PantryItemUnit;
  delta: number;
  newTotal: number;
  direction: BatchDirection;
  source: "manual" | "scan";
};

type State = { items: PrototypeItem[]; entries: BatchEntry[] };

type CommitAction = {
  type: "commit";
  items: PrototypeItem[];
  entry: BatchEntry;
};

function reducer(state: State, action: CommitAction): State {
  return { items: action.items, entries: [action.entry, ...state.entries] };
}

export function useBatchSession(initialItems: PrototypeItem[]) {
  const [state, dispatch] = useReducer(reducer, {
    items: initialItems,
    entries: [],
  });

  // Returns the committed entry synchronously (rather than only dispatching)
  // so a caller like the barcode-registration flow can chain straight off
  // the item it just created/resolved, without waiting a render for state
  // to catch up.
  function applyEntry(input: {
    itemId?: string;
    newItemName?: string;
    unit: PantryItemUnit;
    delta: number;
    direction: BatchDirection;
    source: "manual" | "scan";
  }): BatchEntry | undefined {
    let items = state.items;
    let target = input.itemId
      ? items.find((item) => item.id === input.itemId)
      : undefined;

    if (!target && input.newItemName) {
      target = {
        id: `proto-item-${Math.random().toString(36).slice(2, 9)}`,
        name: input.newItemName,
        unit: input.unit,
        quantity: 0,
      };
      items = [...items, target];
    }

    if (!target) {
      return undefined;
    }

    // Mirrors the real clamp (removing below available stock clamps to
    // zero, never rejected) rather than the app's server-side decrement,
    // since this never touches the server.
    const newTotal = Math.max(0, target.quantity + input.delta);
    const resolvedTarget = target;
    items = items.map((item) =>
      item.id === resolvedTarget.id ? { ...item, quantity: newTotal } : item,
    );

    const entry: BatchEntry = {
      id: `entry-${Math.random().toString(36).slice(2, 9)}`,
      itemId: resolvedTarget.id,
      itemName: resolvedTarget.name,
      unit: input.unit,
      delta: input.delta,
      newTotal,
      direction: input.direction,
      source: input.source,
    };

    dispatch({ type: "commit", items, entry });
    return entry;
  }

  return { items: state.items, entries: state.entries, applyEntry };
}

// A fixed pair of demo barcode values so "Simulate scan" always exercises
// the same two paths — a registered barcode and an unregistered one —
// regardless of which item the registered one is seeded against.
export const DEMO_KNOWN_BARCODE = "0511111319917";
export const DEMO_UNKNOWN_BARCODE = "7300156119999";

// Household-scoped many-barcodes-to-one-item map (ADR 0007), kept in memory
// per prototype session rather than the real barcode_registrations table.
export function useBarcodeRegistry(knownItemId: string | undefined) {
  const [registry, setRegistry] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    if (knownItemId) {
      seed[DEMO_KNOWN_BARCODE] = knownItemId;
    }
    return seed;
  });

  function register(barcode: string, itemId: string) {
    setRegistry((current) => ({ ...current, [barcode]: itemId }));
  }

  function resolve(barcode: string): string | undefined {
    return registry[barcode];
  }

  return { register, resolve };
}
