// Shared visual style for the Radix `DropdownMenu.Content`/`Item` pair
// behind AccountMenu and RowActionsMenu (PER-270) — kept identical to the
// panel/item look those two had before the migration off the hand-rolled
// `Menu` primitive (ADR 0004, PER-266). `data-[highlighted]` replaces the
// old `hover:` variant since Radix sets that attribute for both pointer
// hover and keyboard roving-tabindex navigation.
export const DROPDOWN_PANEL_CLASS =
  "z-10 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900";

export const DROPDOWN_ITEM_CLASS =
  "block w-full cursor-default px-3 py-2 text-left text-zinc-700 outline-none data-[highlighted]:bg-zinc-100 dark:text-zinc-300 dark:data-[highlighted]:bg-zinc-800";
