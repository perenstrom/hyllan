// Shared icon-button shape (border, rounding, color, disabled state) that
// every square icon button in the app builds on, sized by whatever the
// caller appends — the Actions column's 32px controls (ADR 0004) and Stock
// take's larger steppers (PER-265) are both this shape at a different size,
// not two independently-invented button styles.
export const ACTION_BUTTON_BASE_CLASS =
  "flex items-center justify-center rounded border border-zinc-300 text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300";

// 32px touch target per ADR 0004, shared by every control in the Actions
// column (decrement, increment, and the overflow menu trigger).
export const ACTION_BUTTON_CLASS = `${ACTION_BUTTON_BASE_CLASS} h-8 w-8`;
export const ACTION_ICON_CLASS = "h-4 w-4";
