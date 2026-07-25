"use server";

import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { getHouseholdForUser } from "@/lib/household";
import { parsePantryItemInput } from "@/lib/pantry-item";
import { addPantryItem } from "@/lib/pantry-items";
import { createClient } from "@/lib/supabase/server";

export type AddItemState = { error: string } | undefined;

export async function addItem(
  _prevState: AddItemState,
  formData: FormData,
): Promise<AddItemState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const parsed = parsePantryItemInput(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const household = await getHouseholdForUser(db, data.claims.sub);
  await addPantryItem(db, household.id, parsed.value);

  redirect("/");
}
