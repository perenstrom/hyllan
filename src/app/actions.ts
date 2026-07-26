"use server";

import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { deleteUserAccount } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deleteAccount() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  await deleteUserAccount(db, data.claims.sub);
  await supabase.auth.signOut();
  redirect("/login");
}
