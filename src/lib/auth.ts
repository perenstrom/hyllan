import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Bundled with the Supabase client (not just the claims) since some callers
// need it afterward — e.g. deleteAccount signs out through the same client
// once it's used the claims.
export async function getSessionClaims() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, claims: data?.claims };
}

// Redirects to /login when signed out — the shape every page/action wants
// except the root page, which renders a signed-out state in place instead
// and so calls getSessionClaims() directly.
export async function requireSessionClaims() {
  const { supabase, claims } = await getSessionClaims();
  if (!claims) {
    redirect("/login");
  }
  return { supabase, claims };
}
