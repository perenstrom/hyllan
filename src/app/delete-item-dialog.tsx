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
//
// Unlike DeleteAccountDialog (a page-wide singleton that stays mounted and
// toggles native open/close), this one is instantiated once per row, and
// its heading repeats the item's own name ("Delete Rice?"). Left mounted
// while closed, that text sits in the DOM regardless of the native
// dialog's display:none, which collided with plain-text-content assertions
// elsewhere on the page (e2e, PER-269) — so this renders nothing at all
// until open.
export function DeleteItemDialog({
  itemId,
  itemName,
  open,
  onOpenChange,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Depends on `open`, not just mount: this component instance persists
  // across re-renders even though its output toggles between null and the
  // dialog tree below, so an empty-deps effect would only ever fire before
  // `open` first becomes true and never again.
  useEffect(() => {
    dialogRef.current?.showModal();
  }, [open]);

  // A plain wrapper rather than binding deleteItem directly to the form
  // action: React appends the submitted FormData as an extra argument, and
  // deleteItem only takes itemId — itemId is already in scope via props, so
  // no .bind is needed to get it there.
  async function handleDelete() {
    await deleteItem(itemId);
  }

  if (!open) {
    return null;
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
        <form action={handleDelete}>
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
