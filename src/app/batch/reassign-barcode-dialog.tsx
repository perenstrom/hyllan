"use client";

import { useEffect, useId, useRef } from "react";

import {
  DIALOG_ACTIONS_CLASS,
  DIALOG_BUTTON_SIZE_CLASS,
  DIALOG_CLASS,
} from "@/app/dialog-styles";

type Props = {
  fromItemName: string;
  toItemName: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Repointing a barcode that's already registered to another item needs
// the household's explicit say-so (ADR 0007) — a mis-scan shouldn't
// quietly break a working registration. Same native-<dialog> shape as
// DeleteItemDialog (a bottom sheet on mobile), mounted only while there's
// a reassignment to confirm.
export function ReassignBarcodeDialog({
  fromItemName,
  toItemName,
  pending,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onClose={onCancel}
      className={`${DIALOG_CLASS} sm:max-w-md`}
    >
      <h2
        id={headingId}
        className="text-lg font-semibold text-black dark:text-zinc-50"
      >
        Move this barcode to {toItemName}?
      </h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        It&apos;s currently registered to {fromItemName}. Future scans will
        count as {toItemName} instead.
      </p>
      <div className={DIALOG_ACTIONS_CLASS}>
        <button
          type="button"
          onClick={onCancel}
          className={`${DIALOG_BUTTON_SIZE_CLASS} rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={`${DIALOG_BUTTON_SIZE_CLASS} rounded bg-black px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-black`}
        >
          Move barcode
        </button>
      </div>
    </dialog>
  );
}
