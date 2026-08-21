"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { ResetPasswordForm } from "./reset-password-form";
import { updatePassword, type UpdatePasswordResult } from "./update-password";
import { LoadingIndicator } from "@/app/loading-indicator";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  // Created inside the effect below, not via a useState initializer — this
  // page is prerendered at build time (no dynamic APIs force it out of
  // static generation), and createClient() throws without
  // NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, which the build environment doesn't
  // set (see login/log-in.ts, change-password.ts et al. — every other page
  // in this app makes the same call only from inside a browser-only event
  // handler for this exact reason). One client for the whole page lifecycle
  // regardless (see update-password.ts) — the recovery link's one-time code
  // is consumed by this instance's own initialization, detecting it from
  // the URL on mount.
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    let ignore = false;
    const client = createClient();
    client.auth.getClaims().then(({ data }) => {
      if (!ignore) {
        setSupabase(client);
        setSessionReady(Boolean(data?.claims));
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  const [state, formAction, pending] = useActionState<
    UpdatePasswordResult | undefined,
    FormData
  >(
    // Only reachable once the form below is rendered, which itself only
    // happens once sessionReady is true — set in the same effect that sets
    // supabase, so it's never null by then.
    (prevState, formData) => updatePassword(supabase!, prevState, formData),
    undefined,
  );

  useEffect(() => {
    if (state && "success" in state) {
      router.refresh();
      router.push("/");
    }
  }, [state, router]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Set a new password
        </h1>

        {sessionReady === null && <LoadingIndicator />}

        {sessionReady === false && (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              This password reset link is invalid or has expired.
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <Link href="/forgot-password" className="underline">
                Request a new one
              </Link>
            </p>
          </>
        )}

        {sessionReady === true && (
          <ResetPasswordForm
            formAction={formAction}
            pending={pending}
            error={state && "error" in state ? state.error : undefined}
          />
        )}
      </div>
    </div>
  );
}
