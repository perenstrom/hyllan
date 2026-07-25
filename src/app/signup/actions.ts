"use server";

import { redirect } from "next/navigation";

import { db } from "@/db/client";
import { createHouseholdForUser } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

export type SignUpState = { error: string } | undefined;

export async function signUp(
  _prevState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error || !data.user) {
    return { error: error?.message ?? "Could not create account." };
  }

  await createHouseholdForUser(db, data.user.id);

  redirect("/");
}
