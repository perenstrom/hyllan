"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { ACTION_BUTTON_CLASS, ACTION_ICON_CLASS } from "./action-button";
import {
  DROPDOWN_ITEM_CLASS,
  DROPDOWN_PANEL_CLASS,
} from "./dropdown-menu-styles";
import { deleteItem } from "./items/actions";

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
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${itemName}`}
          className={ACTION_BUTTON_CLASS}
        >
          <MoreHorizontal className={ACTION_ICON_CLASS} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={DROPDOWN_PANEL_CLASS}
        >
          <DropdownMenu.Item asChild>
            <Link
              href={`/items/${itemId}/edit`}
              className={DROPDOWN_ITEM_CLASS}
            >
              Edit
            </Link>
          </DropdownMenu.Item>
          {/* Not a submitting <form> button: Radix unmounts the menu (and
              this button) synchronously within the same click, and a
              detached submit button's native form-submission gets silently
              cancelled by the browser before it fires — deleteItem takes no
              FormData, so calling it directly sidesteps that race. */}
          <DropdownMenu.Item asChild>
            <button
              type="button"
              onClick={() => {
                void deleteItem(itemId);
              }}
              className={DROPDOWN_ITEM_CLASS}
            >
              Delete
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
