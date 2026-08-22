"use client";

type Props = {
  title: string;
  onClose: () => void;
};

// The <dialog> chrome shared by every stock take dialog (PER-265, Linear
// resolution comment's "Mobile" bullet): below the `sm` breakpoint it drops
// its border/radius and shrinks its padding — the same card-to-edge-to-
// edge treatment the inventory table uses (signed-in-home.tsx) — rather
// than staying a floating card on a phone-width screen. Callers append
// their own max-w-* (the launcher's picker is narrower than the two flows
// it opens into).
export const STOCK_TAKE_DIALOG_CLASS =
  "m-auto w-full border-0 bg-white p-4 backdrop:bg-black/40 dark:bg-zinc-900 sm:rounded-lg sm:border sm:border-zinc-200 sm:p-6 dark:sm:border-zinc-800";

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
