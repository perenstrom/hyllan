"use client";

// PROTOTYPE — wipe me. Edit/Delete aren't part of PER-268's question, and
// the real RowActionsMenu is wired to real server actions on real
// household data — not safe to mount here. This is a visual stand-in only.

import { MoreHorizontal } from "lucide-react";

import { ACTION_BUTTON_CLASS, ACTION_ICON_CLASS } from "../action-button";

export function StubOverflowButton() {
  return (
    <button
      type="button"
      disabled
      aria-label="Actions (not wired in this prototype)"
      className={`${ACTION_BUTTON_CLASS} opacity-40`}
    >
      <MoreHorizontal className={ACTION_ICON_CLASS} aria-hidden="true" />
    </button>
  );
}
