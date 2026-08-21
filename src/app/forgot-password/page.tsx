import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Reset your password
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Enter your email and we&apos;ll send you a link to reset your
          password.
        </p>

        <ForgotPasswordForm />

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/login" className="underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
