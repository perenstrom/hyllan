"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { ACTION_BUTTON_CLASS, ACTION_ICON_CLASS } from "./action-button";
import { deleteItem } from "./items/actions";
import { Menu, MENU_ITEM_CLASS, MENU_PANEL_CLASS } from "./menu";

type Props = {
  itemId: string;
  itemName: string;
};

// The row's Edit/Delete overflow trigger (ADR 0004, PER-266) — built on the
// shared Menu primitive, the third consumer alongside AccountMenu and
// StatusFilterDropdown. Items are plain text, no icons, matching the
// account menu's style.
export function RowActionsMenu({ itemId, itemName }: Props) {
  return (
    <Menu
      panelRole="menu"
      panelClassName={MENU_PANEL_CLASS}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={`Actions for ${itemName}`}
          className={ACTION_BUTTON_CLASS}
        >
          <MoreHorizontal className={ACTION_ICON_CLASS} aria-hidden="true" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <Link
            href={`/items/${itemId}/edit`}
            role="menuitem"
            onClick={close}
            className={MENU_ITEM_CLASS}
          >
            Edit
          </Link>
          <form action={deleteItem.bind(null, itemId)}>
            <button type="submit" role="menuitem" className={MENU_ITEM_CLASS}>
              Delete
            </button>
          </form>
        </>
      )}
    </Menu>
  );
}
