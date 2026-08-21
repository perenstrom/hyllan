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
