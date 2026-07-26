"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { getHouseholdForUser } from "@/lib/household";
import { parsePantryItemInput } from "@/lib/pantry-item";
import {
  addPantryItem,
  decrementPantryItemQuantity,
  deletePantryItem,
  DuplicatePantryItemNameError,
  incrementPantryItemQuantity,
  updatePantryItem,
} from "@/lib/pantry-items";
import { createClient } from "@/lib/supabase/server";

export type AddItemState = { error: string } | undefined;
export type EditItemState = { error: string } | undefined;

async function requireClaims() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }
  return data.claims;
}

export async function addItem(
  _prevState: AddItemState,
  formData: FormData,
): Promise<AddItemState> {
  const claims = await requireClaims();

  const parsed = parsePantryItemInput(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const household = await getHouseholdForUser(db, claims.sub);
  await addPantryItem(db, household.id, parsed.value);

  redirect("/");
}

export async function incrementItem(itemId: string): Promise<void> {
  const claims = await requireClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  await incrementPantryItemQuantity(db, household.id, itemId);
  revalidatePath("/");
}

export async function decrementItem(itemId: string): Promise<void> {
  const claims = await requireClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  await decrementPantryItemQuantity(db, household.id, itemId);
  revalidatePath("/");
}

export async function deleteItem(itemId: string): Promise<void> {
  const claims = await requireClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  await deletePantryItem(db, household.id, itemId);
  revalidatePath("/");
}

export async function editItem(
  itemId: string,
  _prevState: EditItemState,
  formData: FormData,
): Promise<EditItemState> {
  const claims = await requireClaims();

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
