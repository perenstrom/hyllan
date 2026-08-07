"use client";

import Link from "next/link";
import { useState } from "react";

import { signOut } from "./actions";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { UserIcon } from "./icons";
import { Menu, MENU_ITEM_CLASS, MENU_PANEL_CLASS } from "./menu";

// Avatar-triggered dropdown reachable from any page (ADR 0004) — built on
// the shared Menu primitive (ADR 0004, PER-266) for its open/close-on-
// outside-click behavior and role="menu" panel.
export function AccountMenu() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <Menu
        panelRole="menu"
        panelClassName={MENU_PANEL_CLASS}
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="true"
            aria-expanded={open}
            aria-label="Account menu"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            <UserIcon className="h-4 w-4" />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <Link
              href="/account"
              role="menuitem"
              onClick={close}
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
                close();
                setDeleteDialogOpen(true);
              }}
              className={`${MENU_ITEM_CLASS} text-red-600 dark:text-red-500`}
            >
              Delete account
            </button>
          </>
        )}
      </Menu>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </>
  );
}
