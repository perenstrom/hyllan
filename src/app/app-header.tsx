import Link from "next/link";

import { AccountMenu } from "./account-menu";

// Shared across every signed-in page so the account menu (ADR 0004) is
// reachable from any of them, not just the pantry list. Sticky below the
// small breakpoint so navigation stays in reach on a long mobile list.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-zinc-50/90 px-4 py-2.5 backdrop-blur sm:static sm:bg-transparent sm:px-6 sm:py-4 sm:backdrop-blur-none dark:border-zinc-800 dark:bg-black/90 sm:dark:bg-transparent">
      <Link href="/" className="font-semibold text-black dark:text-zinc-50">
        Hyllan
      </Link>
      <AccountMenu />
    </header>
  );
}
