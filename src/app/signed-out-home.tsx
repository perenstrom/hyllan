import Link from "next/link";

export function SignedOutHome() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex max-w-md flex-col items-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Hyllan
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Households sign up, then track what pantry items they have and how
          much of each.
        </p>
        <div className="flex gap-3">
          <Link
            href="/signup"
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Log in
          </Link>
        </div>
      </main>
    </div>
  );
}
