"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import {
  addLocation,
  deleteLocation,
  DuplicateLocationNameError,
  renameLocation,
} from "@/lib/locations";
import { parseQuantity } from "@/lib/pantry-item";
import { setPantryItemLocationQuantity } from "@/lib/pantry-items";

export type CreateLocationResult =
  | { ok: true; location: { id: string; name: string } }
  | { ok: false; error: string };

// Called directly from client components (the add-item/edit-item location
// combobox, and the manage-locations page's "add" field) rather than bound
// to a <form>, so it returns a result instead of redirecting/throwing —
// both callers need the created location back to select it immediately.
export async function createLocation(
  name: string,
): Promise<CreateLocationResult> {
  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);

  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Location name is required." };
  }

  try {
    const location = await addLocation(db, household.id, trimmed);
    revalidatePath("/");
    revalidatePath("/locations");
    return { ok: true, location: { id: location.id, name: location.name } };
  } catch (error) {
    if (error instanceof DuplicateLocationNameError) {
      return {
        ok: false,
        error: "You already have a location with that name.",
      };
    }
    throw error;
  }
}

export type RenameLocationResult =
  | { ok: true; location: { id: string; name: string } }
  | { ok: false; error: string };

export async function renameLocationAction(
  locationId: string,
  name: string,
): Promise<RenameLocationResult> {
  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);

  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Location name is required." };
  }

  try {
    const location = await renameLocation(
      db,
      household.id,
      locationId,
      trimmed,
    );
    if (!location) {
      return { ok: false, error: "Location not found." };
    }
    revalidatePath("/");
    revalidatePath("/locations");
    return { ok: true, location: { id: location.id, name: location.name } };
  } catch (error) {
    if (error instanceof DuplicateLocationNameError) {
      return {
        ok: false,
        error: "You already have a location with that name.",
      };
    }
    throw error;
  }
}

export async function deleteLocationAction(locationId: string): Promise<void> {
  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  await deleteLocation(db, household.id, locationId);
  revalidatePath("/");
  revalidatePath("/locations");
}

export type SetStockTakeQuantityResult =
  { ok: true; quantity: string } | { ok: false; error: string };

// Stock take's per-item correction (PER-265) — called directly from the
// stock-to-shelf/shelf-to-stock dialogs on each field's blur, same
// direct-call (not form-bound) shape as createLocation above, since both
// flows manage their own local state rather than a <form>'s pending state.
export async function setStockTakeQuantity(
  itemId: string,
  locationId: string,
  rawQuantity: string,
): Promise<SetStockTakeQuantityResult> {
  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);

  const quantity = parseQuantity(rawQuantity);
  if (quantity === null) {
    return {
      ok: false,
      error: "Quantity must be zero or a positive number.",
    };
  }

  const updated = await setPantryItemLocationQuantity(
    db,
    household.id,
    itemId,
    locationId,
    quantity,
  );
  if (!updated) {
    return { ok: false, error: "Item not found." };
  }

  revalidatePath("/");
  revalidatePath("/locations");
  return { ok: true, quantity };
}
