"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useState } from "react";

import { signOut } from "./actions";
import { DeleteAccountDialog } from "./delete-account-dialog";
import {
  DROPDOWN_ITEM_CLASS,
  DROPDOWN_PANEL_CLASS,
} from "./dropdown-menu-styles";
import { UserIcon } from "./icons";

// Avatar-triggered dropdown reachable from any page (ADR 0004). Built on
// Radix's DropdownMenu primitive (ADR 0004, PER-270) rather than the shared
// hand-rolled `Menu` — gets Escape-to-close and arrow-key roving-tabindex
// navigation between items for free.
export function AccountMenu() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            <UserIcon className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className={DROPDOWN_PANEL_CLASS}
            // Radix returns focus to the trigger once the menu finishes
            // closing; skip that when "Delete account" is what closed it; so
            // it doesn't fight the dialog's own showModal()-driven focus
            // trap (Radix's documented pattern for a menu item that opens a
            // dialog).
            onCloseAutoFocus={(event) => {
              if (deleteDialogOpen) {
                event.preventDefault();
              }
            }}
          >
            <DropdownMenu.Item asChild>
              <Link href="/account" className={DROPDOWN_ITEM_CLASS}>
                Account
              </Link>
            </DropdownMenu.Item>
            <form action={signOut}>
              <DropdownMenu.Item asChild>
                <button type="submit" className={DROPDOWN_ITEM_CLASS}>
                  Sign out
                </button>
              </DropdownMenu.Item>
            </form>
            <DropdownMenu.Item asChild>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className={`${DROPDOWN_ITEM_CLASS} text-red-600 dark:text-red-500`}
              >
                Delete account
              </button>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </>
  );
}
