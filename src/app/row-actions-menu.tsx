"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ACTION_BUTTON_CLASS, ACTION_ICON_CLASS } from "./action-button";
import { DeleteItemDialog } from "./delete-item-dialog";
import {
  DROPDOWN_ITEM_CLASS,
  DROPDOWN_PANEL_CLASS,
} from "./dropdown-menu-styles";

type Props = {
  itemId: string;
  itemName: string;
};

// The row's Edit/Delete overflow trigger (ADR 0004, PER-266). Built on
// Radix's DropdownMenu primitive (ADR 0004, PER-270) rather than the shared
// hand-rolled `Menu` — its portal rendering keeps the panel from being
// clipped by the table's `overflow-x-auto` scroll wrapper, and it gets
// Escape-to-close/roving-tabindex for free. Items are plain text, no icons,
// matching the account menu's style.
export function RowActionsMenu({ itemId, itemName }: Props) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${itemName}`}
            className={ACTION_BUTTON_CLASS}
          >
            <MoreHorizontal
              className={ACTION_ICON_CLASS}
              aria-hidden="true"
            />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className={DROPDOWN_PANEL_CLASS}
            // Radix returns focus to the trigger once the menu finishes
            // closing; skip that when the delete dialog is what closed it,
            // so it doesn't fight the dialog's own showModal()-driven focus
            // trap (Radix's documented pattern for a menu item that opens a
            // dialog, matching AccountMenu's "Delete account").
            onCloseAutoFocus={(event) => {
              if (deleteDialogOpen) {
                event.preventDefault();
              }
            }}
          >
            <DropdownMenu.Item asChild>
              <Link
                href={`/items/${itemId}/edit`}
                className={DROPDOWN_ITEM_CLASS}
              >
                Edit
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className={DROPDOWN_ITEM_CLASS}
              >
                Delete
              </button>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DeleteItemDialog
        itemId={itemId}
        itemName={itemName}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </>
  );
}
