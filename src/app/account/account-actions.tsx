"use client";

import { useState } from "react";

import { signOut } from "../actions";
import { DeleteAccountDialog } from "../delete-account-dialog";

// Hosts the same two actions as the avatar dropdown (ADR 0004) for a
// dedicated, always-reachable-by-URL entry point to account basics.
export function AccountActions() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <form action={signOut}>
        <button
          type="submit"
          className="w-full rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Sign out
        </button>
      </form>

      <button
        type="button"
        onClick={() => setDeleteDialogOpen(true)}
        className="w-full rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 dark:border-red-900 dark:text-red-500"
      >
        Delete account
      </button>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}
