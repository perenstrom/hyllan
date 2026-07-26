"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOut } from "./actions";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { UserIcon } from "./icons";

const MENU_ITEM_CLASS =
  "block w-full px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

// Avatar-triggered dropdown reachable from any page (ADR 0004) — a client
// component (unlike the plain sign-out form it replaced) since it now has
// more than one action and needs open/close state.
export function AccountMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-label="Account menu"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
      >
        <UserIcon className="h-4 w-4" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className={MENU_ITEM_CLASS}
          >
            Account
          </Link>
          <form action={signOut}>
            <button type="submit" role="menuitem" className={MENU_ITEM_CLASS}>
              Sign out
            </button>
          </form>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setDeleteDialogOpen(true);
            }}
            className={`${MENU_ITEM_CLASS} text-red-600 dark:text-red-500`}
          >
            Delete account
          </button>
        </div>
      )}

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}
