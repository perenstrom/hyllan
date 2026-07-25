"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { createClient } from "@/lib/supabase/client";

type LogInState = { error: string } | undefined;

export default function LogInPage() {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<LogInState, FormData>(
    async (_prevState, formData) => {
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

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      // Cookies are already set (browser client's cookie storage); refresh
      // so Server Components pick up the new session before navigating.
      router.refresh();
      router.push("/");
      return undefined;
    },
    undefined,
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Log in
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
            autoComplete="current-password"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {pending ? "Logging in…" : "Log in"}
        </button>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
