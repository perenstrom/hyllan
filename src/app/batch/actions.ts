"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import type { PantryItemUnit } from "@/lib/pantry-item";
import { parseQuantity } from "@/lib/pantry-item";
import {
  addPantryItem,
  adjustPantryItemQuantityBy,
  PantryItemUnitMismatchError,
} from "@/lib/pantry-items";

// One applied change in a batch-entry session (PER-307): the signed delta
// actually written (clamped removals report what was really removed) and
// the item's total across all its buckets afterward.
export type BatchEntryChange = {
  itemId: string;
  itemName: string;
  unit: PantryItemUnit;
  delta: string;
  total: string;
};

export type BatchEntryResult =
  { ok: true; entry: BatchEntryChange } | { ok: false; error: string };

// Batch entry only ever touches the implicit unassigned bucket — Location
// awareness is out of scope for it (PER-274's Notes).
const UNASSIGNED = null;

// Called directly from the batch-entry page for every commit and every
// Reverse (which is just the inverse delta, applied against the item's
// current quantity) — same direct-call, result-returning shape as
// setStockTakeQuantity, since the page keeps its own session log.
export async function adjustBatchItem(
  itemId: string,
  rawDelta: string,
): Promise<BatchEntryResult> {
  const { claims } = await requireSessionClaims();

  const trimmed = rawDelta.trim();
  const magnitude = parseQuantity(trimmed.replace(/^-/, ""));
  if (magnitude === null) {
    return { ok: false, error: "Quantity must be a number." };
  }
  const delta = trimmed.startsWith("-") ? `-${magnitude}` : magnitude;

  const household = await getHouseholdForUser(db, claims.sub);
  const result = await adjustPantryItemQuantityBy(
    db,
    household.id,
    itemId,
    UNASSIGNED,
    delta,
  );
  if (!result) {
    return { ok: false, error: "Item not found." };
  }

  revalidatePath("/");
  return {
    ok: true,
    entry: {
      itemId: result.item.id,
      itemName: result.item.name,
      unit: result.item.unit,
      delta: result.appliedDelta,
      total: result.item.quantity,
    },
  };
}

// Add mode's "Add '<text>' as a new item" — goes through addPantryItem's
// increment-or-create path (ADR 0001), so a name that turns out to exist
// after all (another tab, a stale list) merges rather than duplicating.
// Unit defaults to count: the quick-entry row has no unit picker.
export async function createBatchItem(
  rawName: string,
  rawQuantity: string,
): Promise<BatchEntryResult> {
  const { claims } = await requireSessionClaims();

  const name = rawName.trim();
  if (!name) {
    return { ok: false, error: "Name is required." };
  }
  const quantity = parseQuantity(rawQuantity);
  if (quantity === null || Number(quantity) <= 0) {
    return { ok: false, error: "Quantity must be a positive number." };
  }

  const household = await getHouseholdForUser(db, claims.sub);

  let item;
  try {
    item = await addPantryItem(db, household.id, {
      name,
      quantity,
      unit: "count",
      locationId: UNASSIGNED,
    });
  } catch (error) {
    if (error instanceof PantryItemUnitMismatchError) {
      return {
        ok: false,
        error: `${error.itemName} is already tracked in ${error.unit}. Pick it from the list to add to it.`,
      };
    }
    throw error;
  }

  revalidatePath("/");
  return {
    ok: true,
    entry: {
      itemId: item.id,
      itemName: item.name,
      unit: item.unit,
      delta: quantity,
      total: item.quantity,
    },
  };
}
