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

  // The row is gone before signOut() runs, so GoTrue's logout call 404s —
  // auth-js treats that as an ignorable error and still clears the local
  // session/cookies, so the user ends up signed out either way (verified by
  // e2e/account.spec.ts's re-login-fails assertion after deletion).
  await deleteUserAccount(db, data.claims.sub);
  await supabase.auth.signOut();
  redirect("/login");
}
