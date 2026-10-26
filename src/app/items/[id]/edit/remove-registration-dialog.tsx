"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { removeItemRegistration } from "./registration-actions";
import {
  DIALOG_ACTIONS_CLASS,
  DIALOG_BUTTON_SIZE_CLASS,
  DIALOG_CLASS,
} from "@/app/dialog-styles";

type Props = {
  registrationId: string;
  // As printed on the package (displayBarcodeValue).
  digits: string;
  onClose: () => void;
};

// Same confirm pattern as DeleteItemDialog (PER-269's single destructive
// confirmation pattern), mounted only while a removal is being confirmed.
export function RemoveRegistrationDialog({
  registrationId,
  digits,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function handleRemove() {
    const result = await removeItemRegistration(registrationId);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={`${DIALOG_CLASS} sm:max-w-md`}
    >
      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
        Remove barcode {digits}?
      </h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        Scans of this barcode will no longer count toward this item. Scanning it
        again will register it again.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className={DIALOG_ACTIONS_CLASS}>
        <button
          type="button"
          onClick={onClose}
          className={`${DIALOG_BUTTON_SIZE_CLASS} rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300`}
        >
          Cancel
        </button>
        <form action={handleRemove}>
          <RemoveButton />
        </form>
      </div>
    </dialog>
  );
}

// Disabled while the removal is in flight, so a double tap doesn't send a
// second remove that comes back not-found.
function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${DIALOG_BUTTON_SIZE_CLASS} rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50`}
    >
      Remove
    </button>
  );
}
