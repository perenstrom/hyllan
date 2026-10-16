"use client";

import { DIALOG_CLASS } from "@/app/dialog-styles";

type Props = {
  title: string;
  onClose: () => void;
};

// The <dialog> chrome shared by every stock take dialog (PER-265): the
// app-wide bottom-sheet-on-mobile shape (dialog-styles.ts). Callers append
// their own sm:max-w-* (the launcher's picker is narrower than the two
// flows it opens into).
export const STOCK_TAKE_DIALOG_CLASS = DIALOG_CLASS;

// The title-plus-close-button row shared by every stock take dialog
// (PER-265) — identical across the start picker's chosen flows.
export function StockTakeDialogHeader({ title, onClose }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close stock take"
        className="text-sm text-zinc-500 underline dark:text-zinc-500"
      >
        Close
      </button>
    </div>
  );
}
