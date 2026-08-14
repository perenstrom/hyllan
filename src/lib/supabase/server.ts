import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { internalGoTrueFetch } from "./internal-fetch";

export async function createClient() {
  const cookieStore = await cookies();
  const fetch = internalGoTrueFetch();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(fetch ? { global: { fetch } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, which can't set cookies.
            // proxy.ts refreshes the session on every request instead, so
            // this is safe to ignore.
          }
        },
      },
    },
  );
}
