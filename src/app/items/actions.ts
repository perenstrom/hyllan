"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import { parsePantryItemInput } from "@/lib/pantry-item";
import {
  addPantryItem,
  decrementPantryItemQuantity,
  deletePantryItem,
  DuplicatePantryItemNameError,
  incrementPantryItemQuantity,
  PantryItemUnitMismatchError,
  updatePantryItem,
} from "@/lib/pantry-items";

export type AddItemState = { error: string } | undefined;
export type EditItemState = { error: string } | undefined;

export async function addItem(
  _prevState: AddItemState,
  formData: FormData,
): Promise<AddItemState> {
  const { claims } = await requireSessionClaims();

  const parsed = parsePantryItemInput(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const household = await getHouseholdForUser(db, claims.sub);

  try {
    await addPantryItem(db, household.id, parsed.value);
  } catch (error) {
    if (error instanceof PantryItemUnitMismatchError) {
      return {
        error: `${error.itemName} is already tracked in ${error.unit}. Enter this amount in ${error.unit}, or edit the item to change its unit.`,
      };
    }
    throw error;
  }

  redirect("/");
}

export async function incrementItem(itemId: string): Promise<void> {
  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  await incrementPantryItemQuantity(db, household.id, itemId);
  revalidatePath("/");
}

export async function decrementItem(itemId: string): Promise<void> {
  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  await decrementPantryItemQuantity(db, household.id, itemId);
  revalidatePath("/");
}

export async function deleteItem(itemId: string): Promise<void> {
  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  await deletePantryItem(db, household.id, itemId);
  revalidatePath("/");
}

export async function editItem(
  itemId: string,
  _prevState: EditItemState,
  formData: FormData,
): Promise<EditItemState> {
  const { claims } = await requireSessionClaims();

  const parsed = parsePantryItemInput(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const household = await getHouseholdForUser(db, claims.sub);

  try {
    const updated = await updatePantryItem(
      db,
      household.id,
      itemId,
      parsed.value,
    );
    if (!updated) {
      return { error: "Item not found." };
    }
  } catch (error) {
    if (error instanceof DuplicatePantryItemNameError) {
      return { error: "You already have an item with that name." };
    }
    throw error;
  }

  redirect("/");
}
