// Shared shape for the single-panel pages (add/edit item, locations,
// account): a centered bordered card from the small breakpoint up, but
// top-aligned and full-bleed below it — on a phone a floating card only
// costs width and pushes the form below the fold.
export const PANEL_MAIN_CLASS =
  "flex flex-1 flex-col gap-8 px-4 pt-5 pb-8 sm:items-center sm:justify-center sm:gap-4 sm:px-6 sm:py-8";

export const PANEL_CARD_CLASS =
  "flex w-full flex-col gap-4 sm:max-w-sm sm:rounded-lg sm:border sm:border-zinc-200 sm:p-6 dark:sm:border-zinc-800";

// Pins a form's submit/cancel row to the bottom of the screen below the
// small breakpoint so it stays in thumb reach; plain flow from sm up.
export const PANEL_FOOTER_CLASS =
  "sticky bottom-0 -mx-4 mt-auto grid grid-cols-[auto_1fr] gap-2 border-t border-zinc-200 bg-zinc-50/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:mt-0 sm:flex sm:flex-col sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none dark:border-zinc-800 dark:bg-black/95 sm:dark:bg-transparent";
