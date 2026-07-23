"use client";

// PROTOTYPE (PER-218) — Variant A: dense operator table, account screen.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { TopBarA } from "./top-bar";
import type { VariantKey } from "@/lib/variant";

export function AccountA({ variant }: { variant: VariantKey }) {
  const [deleted, setDeleted] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <TopBarA variant={variant} />
      <div className="mx-auto w-full max-w-sm px-4 py-8">
        <h1 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Account
        </h1>
        <div className="flex flex-col gap-3">
          <Button variant="outline" className="justify-start">
            Sign out
          </Button>
          <Separator />
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="destructive"
                  className="justify-start"
                  disabled={deleted}
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
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              (Prototype) Account and pantry deleted.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
