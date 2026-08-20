"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { ResetPasswordForm } from "./reset-password-form";
import { updatePassword, type UpdatePasswordResult } from "./update-password";
import { LoadingIndicator } from "@/app/loading-indicator";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  // One client for the whole page lifecycle (see update-password.ts) — the
  // recovery link's one-time code is consumed by this instance's own
  // initialization, detecting it from the URL on mount.
  const [supabase] = useState(() => createClient());
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    let ignore = false;
    supabase.auth.getClaims().then(({ data }) => {
      if (!ignore) {
        setSessionReady(Boolean(data?.claims));
      }
    });
    return () => {
      ignore = true;
    };
  }, [supabase]);

  const [state, formAction, pending] = useActionState<
    UpdatePasswordResult | undefined,
    FormData
  >(
    (prevState, formData) => updatePassword(supabase, prevState, formData),
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
