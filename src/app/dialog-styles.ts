// Shared shape for every native <dialog>: a bottom sheet below the small
// breakpoint (full width, anchored to the bottom edge within thumb reach,
// clear of the home indicator), a centered bordered card from sm up.
// Callers append their own sm: max width (e.g. sm:max-w-lg) — it has to be
// a max-w: with max-w-none and w-full above, sm:w-auto still lets a modal
// <dialog> stretch across the whole viewport.
export const DIALOG_CLASS =
  "mx-0 mt-auto mb-0 w-full max-w-none rounded-t-2xl border-0 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop:bg-black/40 sm:m-auto sm:rounded-lg sm:border sm:border-zinc-200 sm:p-6 dark:bg-zinc-900 dark:sm:border-zinc-800";

// Cancel/confirm pair: two equal full-height buttons on a phone, the
// compact right-aligned pair from sm up.
export const DIALOG_ACTIONS_CLASS =
  "mt-5 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:justify-end";

export const DIALOG_BUTTON_SIZE_CLASS = "h-11 w-full sm:h-auto sm:w-auto";

// For a dialog the household types into: a card anchored near the top on a
// phone rather than DIALOG_CLASS's bottom sheet — the on-screen keyboard
// rises from the bottom edge and would cover a bottom sheet's fields
// (iOS Safari doesn't move fixed content above it). Centered from sm up,
// same as DIALOG_CLASS; callers append their own sm: max width.
export const KEYBOARD_DIALOG_CLASS =
  "mx-4 mt-[max(1rem,env(safe-area-inset-top))] mb-auto w-auto max-w-none rounded-lg border border-zinc-200 bg-white p-4 backdrop:bg-black/40 sm:m-auto sm:w-full sm:p-6 dark:border-zinc-800 dark:bg-zinc-900";
