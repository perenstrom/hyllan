"use client";

import { useActionState } from "react";

import { changePassword, type ChangePasswordResult } from "./change-password";

export function ChangePasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<
    ChangePasswordResult | undefined,
    FormData
  >(
    (prevState, formData) => changePassword(email, prevState, formData),
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="currentPassword"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="newPassword"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="confirmNewPassword"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          Confirm new password
        </label>
        <input
          id="confirmNewPassword"
          name="confirmNewPassword"
          type="password"
          required
          autoComplete="new-password"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {state && "error" in state && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && "success" in state && (
        <p className="text-sm text-green-600">Password changed.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
      >
        {pending ? "Changing password…" : "Change password"}
      </button>
    </form>
  );
}
