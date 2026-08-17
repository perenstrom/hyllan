"use client";

import { useEffect, useRef } from "react";

import { deleteItem } from "./items/actions";

type Props = {
  itemId: string;
  itemName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Delete moved behind the row's overflow menu (ADR 0004, PER-266), which
// reopened whether it should gain a confirmation step now that it's less
// visually exposed. Decided (PER-269): reuse DeleteAccountDialog's exact
// pattern rather than a lighter in-menu two-step, so destructive-action
// confirmation stays a single pattern across the app instead of forking
// per stakes level.
export function DeleteItemDialog({
  itemId,
  itemName,
  open,
  onOpenChange,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // The <form action> pattern passes itemId to deleteItem via .bind, but
  // React also appends the submitted FormData as a final argument — forward
  // only itemId, matching handleIncrement/handleDecrement's convention in
  // signed-in-home.tsx for binding a server action that takes no FormData.
  async function handleDelete(itemId: string) {
    await deleteItem(itemId);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={() => onOpenChange(false)}
      className="m-auto rounded-lg border border-zinc-200 bg-white p-6 backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
        Delete {itemName}?
      </h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        This immediately and permanently deletes this pantry item. This
        cannot be undone.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Cancel
        </button>
        <form action={handleDelete.bind(null, itemId)}>
          <button
            type="submit"
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Delete
          </button>
        </form>
      </div>
    </dialog>
  );
}
