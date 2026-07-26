import Link from "next/link";

import { AccountMenu } from "./account-menu";

// Shared across every signed-in page so the account menu (ADR 0004) is
// reachable from any of them, not just the pantry list.
export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <Link href="/" className="font-semibold text-black dark:text-zinc-50">
        Hyllan
      </Link>
      <AccountMenu />
    </header>
  );
}
