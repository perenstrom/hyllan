"use client";

// PROTOTYPE (PER-218) — Variant B: card grid + modal, dedicated account page.

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
import { ShellB } from "./shell";
import type { VariantKey } from "@/lib/variant";

export function AccountB({ variant }: { variant: VariantKey }) {
  const [deleted, setDeleted] = useState(false);

  return (
    <ShellB variant={variant}>
      <h1 className="mb-6 text-lg font-semibold tracking-tight">Account</h1>
      <div className="max-w-md space-y-8">
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-500">Session</h2>
          <Button variant="outline">Sign out</Button>
        </section>

        <section className="space-y-2 rounded-lg border border-red-200 p-4 dark:border-red-900">
          <h2 className="text-sm font-medium text-red-700 dark:text-red-400">
            Delete account
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This permanently deletes your pantry and all its items. This
            can&apos;t be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="destructive" disabled={deleted} />}
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
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              (Prototype) Account and pantry deleted.
            </p>
          )}
        </section>
      </div>
    </ShellB>
  );
}
