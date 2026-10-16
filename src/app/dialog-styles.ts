// Shared shape for every native <dialog>: a bottom sheet below the small
// breakpoint (full width, anchored to the bottom edge within thumb reach,
// clear of the home indicator), a centered bordered card from sm up.
// Callers append their own sm: width (e.g. sm:max-w-lg).
export const DIALOG_CLASS =
  "mx-0 mt-auto mb-0 w-full max-w-none rounded-t-2xl border-0 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop:bg-black/40 sm:m-auto sm:rounded-lg sm:border sm:border-zinc-200 sm:p-6 dark:bg-zinc-900 dark:sm:border-zinc-800";

// Cancel/confirm pair: two equal full-height buttons on a phone, the
// compact right-aligned pair from sm up.
export const DIALOG_ACTIONS_CLASS =
  "mt-5 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:justify-end";

export const DIALOG_BUTTON_SIZE_CLASS = "h-11 w-full sm:h-auto sm:w-auto";
