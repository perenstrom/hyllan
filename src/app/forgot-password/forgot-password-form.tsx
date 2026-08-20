"use client";

import { useActionState } from "react";

import {
  requestPasswordReset,
  type RequestPasswordResetResult,
} from "./request-password-reset";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    RequestPasswordResetResult | undefined,
    FormData
  >(requestPasswordReset, undefined);

  if (state && "success" in state) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        If an account exists for that email, we&apos;ve sent a link to reset
        your password.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="email"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {state && "error" in state && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
