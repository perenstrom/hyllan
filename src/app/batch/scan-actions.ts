"use server";

import { revalidatePath } from "next/cache";

import type { BatchEntryChange, BatchEntryResult } from "./actions";
import type { BatchDirection } from "./batch-entry";
import type { BatchCommitTarget } from "./batch-entry-row";
import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import {
  canonicalBarcodeValue,
  isBarcodeSymbology,
  isCanonicalBarcodeValue,
  type BarcodeSymbology,
  type ScannedBarcode,
} from "@/lib/barcode";
import {
  findBarcodeRegistration,
  registerBarcode,
} from "@/lib/barcode-registrations";
import { getHouseholdForUser } from "@/lib/household";
import {
  isPantryItemUnit,
  parseQuantityPerScan,
  type PantryItemUnit,
} from "@/lib/pantry-item";
import {
  addPantryItem,
  adjustPantryItemQuantity,
  PantryItemUnitMismatchError,
  type PantryItemWithLocations,
} from "@/lib/pantry-items";
import {
  suggestProductName,
  type ProductNameSuggestion,
} from "@/lib/product-names";

export type BatchScanResult =
  | { ok: true; kind: "applied"; entry: BatchEntryChange }
  | { ok: true; kind: "unregistered"; barcode: ScannedBarcode }
  | { ok: false; error: string };

// A barcode already on another item needs the household's say-so before
// it's repointed (ADR 0007) — the page asks, then calls again with
// reassign set.
export type BatchRegisterResult =
  BatchEntryResult | { ok: false; conflict: { itemName: string } };

// What the pick-or-create panel settled on for a barcode: which item, and
// how much one scan of it is, in that item's unit.
export type BarcodeRegistrationChoice = {
  target: BatchCommitTarget;
  quantityPerScan: string;
  // A new item only — an existing one keeps its own unit.
  newItemUnit?: PantryItemUnit;
};

const UNREADABLE = {
  ok: false,
  error: "That barcode couldn't be read. Try again.",
} as const;

// Same unassigned-bucket-only scope as the text-entry actions (PER-274's
// Notes).
const UNASSIGNED = null;

// A scan moves its registration's amount (ADR 0007's amendment) — one
// pack's worth, in the item's unit.
function scanDelta(direction: BatchDirection, quantityPerScan: string) {
  return direction === "add" ? quantityPerScan : `-${quantityPerScan}`;
}

// Every scan-driven change lands on the page the same way: the item's new
// total, tagged with the barcode so the log can offer "Wrong item?".
function scannedEntry(
  item: PantryItemWithLocations,
  delta: string,
  barcode: ScannedBarcode,
): BatchEntryResult {
  revalidatePath("/");
  return {
    ok: true,
    entry: {
      itemId: item.id,
      itemName: item.name,
      unit: item.unit,
      delta,
      total: item.quantity,
      barcode,
    },
  };
}

async function applyScan(
  householdId: string,
  itemId: string,
  delta: string,
  barcode: ScannedBarcode,
): Promise<BatchEntryResult> {
  const result = await adjustPantryItemQuantity(
    db,
    householdId,
    itemId,
    UNASSIGNED,
    delta,
  );
  if (!result) {
    return { ok: false, error: "Item not found." };
  }
  return scannedEntry(result.item, result.appliedDelta, barcode);
}

// Called with every decoded frame the camera settles on. A registered
// barcode applies its amount straight away; an unregistered one comes back
// canonicalized for the page's pick-or-create panel (add mode) or to be
// shrugged off (remove mode, which never creates).
export async function scanBatchBarcode(
  rawValue: string,
  symbology: string,
  direction: BatchDirection,
): Promise<BatchScanResult> {
  const { claims } = await requireSessionClaims();

  const value = isBarcodeSymbology(symbology)
    ? canonicalBarcodeValue(rawValue, symbology)
    : null;
  if (!value) {
    return UNREADABLE;
  }
  const barcode = { value, symbology: symbology as BarcodeSymbology };

  const household = await getHouseholdForUser(db, claims.sub);
  const registration = await findBarcodeRegistration(db, household.id, value);
  if (!registration) {
    return { ok: true, kind: "unregistered", barcode };
  }

  const result = await applyScan(
    household.id,
    registration.pantryItemId,
    scanDelta(direction, registration.quantityPerScan),
    barcode,
  );
  return result.ok
    ? { ok: true, kind: "applied", entry: result.entry }
    : result;
}

// The pick-or-create panel's commit: registers the barcode to the chosen
// (or newly created) item with its per-scan amount, and applies that
// amount in the same action.
// Also how "Wrong item?" corrects a registration, which is why picking an
// item can hit an existing registration and come back as a conflict.
export async function registerScannedBarcode(
  barcode: ScannedBarcode,
  choice: BarcodeRegistrationChoice,
  direction: BatchDirection,
  reassign: boolean,
): Promise<BatchRegisterResult> {
  const { claims } = await requireSessionClaims();
  const { target } = choice;

  if (
    !isBarcodeSymbology(barcode.symbology) ||
    !isCanonicalBarcodeValue(barcode.value)
  ) {
    return UNREADABLE;
  }

  const quantityPerScan = parseQuantityPerScan(choice.quantityPerScan);
  if (quantityPerScan === null) {
    return { ok: false, error: "Amount must be a positive number." };
  }

  const household = await getHouseholdForUser(db, claims.sub);
  const registration = {
    barcodeValue: barcode.value,
    symbology: barcode.symbology,
    quantityPerScan,
  };

  if ("itemId" in target) {
    const registered = await registerBarcode(db, household.id, {
      ...registration,
      pantryItemId: target.itemId,
      reassign,
    });
    if (registered.status === "item-not-found") {
      return { ok: false, error: "Item not found." };
    }
    if (registered.status === "conflict") {
      return {
        ok: false,
        conflict: { itemName: registered.registeredTo.name },
      };
    }
    return applyScan(
      household.id,
      target.itemId,
      scanDelta(direction, quantityPerScan),
      barcode,
    );
  }

  if (direction === "remove") {
    return { ok: false, error: "Removing stock can't create an item." };
  }
  const name = target.newItemName.trim();
  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  // Checked up front rather than via registerBarcode's own conflict
  // result, so an unconfirmed reassignment doesn't leave a freshly created
  // item behind.
  if (!reassign) {
    const existing = await findBarcodeRegistration(
      db,
      household.id,
      barcode.value,
    );
    if (existing) {
      return { ok: false, conflict: { itemName: existing.itemName } };
    }
  }

  let item;
  try {
    item = await addPantryItem(db, household.id, {
      name,
      quantity: quantityPerScan,
      unit:
        choice.newItemUnit && isPantryItemUnit(choice.newItemUnit)
          ? choice.newItemUnit
          : "count",
      locationId: UNASSIGNED,
    });
  } catch (error) {
    if (error instanceof PantryItemUnitMismatchError) {
      return {
        ok: false,
        error: `${error.itemName} is already tracked in ${error.unit}. Pick it from the list instead.`,
      };
    }
    throw error;
  }
  // The conflict check above already ran (or the household confirmed), so
  // whatever this barcode pointed at is fair game to repoint now.
  await registerBarcode(db, household.id, {
    ...registration,
    pantryItemId: item.id,
    reassign: true,
  });

  return scannedEntry(item, quantityPerScan, barcode);
}

// Background name suggestion for the pick-or-create panel (ADR 0008). A
// miss, a timeout and a malformed value all look the same to the page:
// nothing to suggest.
export async function suggestScannedProductName(
  barcodeValue: string,
): Promise<ProductNameSuggestion | null> {
  await requireSessionClaims();
  if (!isCanonicalBarcodeValue(barcodeValue)) {
    return null;
  }
  return suggestProductName(db, barcodeValue);
}
