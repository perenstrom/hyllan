"use client";

import { useEffect, useRef } from "react";

import { deleteAccount } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Shared by the avatar dropdown and the account page (ADR 0004: both host
// "the same two actions") so the irreversible-deletion copy and behavior
// can't drift between the two entry points. A native <dialog> gives us a
// focus-trapped, Esc-to-close modal without pulling in a component library.
export function DeleteAccountDialog({ open, onOpenChange }: Props) {
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

  return (
    <dialog
      ref={dialogRef}
      onClose={() => onOpenChange(false)}
      // Tailwind's Preflight resets margin to 0 on every element, which
      // wipes out the UA stylesheet's `margin: auto` that normally centers
      // dialog:modal — restore it explicitly.
      className="m-auto rounded-lg border border-zinc-200 bg-white p-6 backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
        Delete account?
      </h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        This immediately and permanently deletes your account and every pantry
        item in it. This cannot be undone.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Cancel
        </button>
        <form action={deleteAccount}>
          <button
            type="submit"
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Delete account
          </button>
        </form>
      </div>
    </dialog>
  );
}
