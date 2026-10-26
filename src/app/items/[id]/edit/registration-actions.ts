"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import {
  removeBarcodeRegistration,
  updateBarcodeQuantityPerScan,
} from "@/lib/barcode-registrations";
import { getHouseholdForUser } from "@/lib/household";
import { parseQuantityPerScan } from "@/lib/pantry-item";

export type ItemRegistrationResult =
  { ok: true } | { ok: false; error: string };

const NOT_FOUND: ItemRegistrationResult = {
  ok: false,
  error: "Barcode not found.",
};

// The id arrives as plain client input, and Postgres throws on a malformed
// uuid rather than matching nothing.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateEditPage() {
  revalidatePath("/items/[id]/edit", "page");
}

// The edit-item page's Barcodes section saves each change on its own,
// independent of the item form's Save.
export async function removeItemRegistration(
  registrationId: string,
): Promise<ItemRegistrationResult> {
  const { claims } = await requireSessionClaims();
  if (!UUID_PATTERN.test(registrationId)) {
    return NOT_FOUND;
  }

  const household = await getHouseholdForUser(db, claims.sub);
  if (!(await removeBarcodeRegistration(db, household.id, registrationId))) {
    return NOT_FOUND;
  }
  revalidateEditPage();
  return { ok: true };
}

// Validated as when registering in the scan flow (registerScannedBarcode).
export async function updateItemRegistrationQuantityPerScan(
  registrationId: string,
  rawQuantityPerScan: string,
): Promise<ItemRegistrationResult> {
  const { claims } = await requireSessionClaims();

  const quantityPerScan = parseQuantityPerScan(rawQuantityPerScan);
  if (quantityPerScan === null) {
    return { ok: false, error: "Amount must be a positive number." };
  }
  if (!UUID_PATTERN.test(registrationId)) {
    return NOT_FOUND;
  }

  const household = await getHouseholdForUser(db, claims.sub);
  const updated = await updateBarcodeQuantityPerScan(
    db,
    household.id,
    registrationId,
    quantityPerScan,
  );
  if (!updated) {
    return NOT_FOUND;
  }
  revalidateEditPage();
  return { ok: true };
}
