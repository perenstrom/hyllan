"use client";

// PROTOTYPE (PER-218) — Variant C: shared account content (used in sheet + full page).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function AccountContentC() {
  const [deleted, setDeleted] = useState(false);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-lg font-semibold tracking-tight">Your pantry</h1>
      <Button variant="outline" className="justify-center">
        Sign out
      </Button>
      <div className="mt-auto pt-10">
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <button
                type="button"
                disabled={deleted}
                className="text-sm text-zinc-400 underline underline-offset-2 hover:text-red-500 dark:text-zinc-600"
              />
            }
          >
            Delete account
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This immediately and permanently deletes your pantry and
                every item in it. There is no grace period and this
                can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => setDeleted(true)}>
                Delete account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {deleted && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            (Prototype) Account and pantry deleted.
          </p>
        )}
      </div>
    </div>
  );
}
