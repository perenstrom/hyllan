"use server";

import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { deleteUserAccount } from "@/lib/account";
import { requireSessionClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deleteAccount() {
  const { supabase, claims } = await requireSessionClaims();

  // The row is gone before signOut() runs, so GoTrue's logout call 404s —
  // auth-js treats that as an ignorable error and still clears the local
  // session/cookies, so the user ends up signed out either way (verified by
  // e2e/account.spec.ts's re-login-fails assertion after deletion).
  await deleteUserAccount(db, claims.sub);
  await supabase.auth.signOut();
  redirect("/login");
}
