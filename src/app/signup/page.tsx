"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUp } from "./actions";

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUp, undefined);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Create your account
        </h1>

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

        <div className="flex flex-col gap-1">
          <label
            htmlFor="password"
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {pending ? "Creating account…" : "Sign up"}
        </button>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
