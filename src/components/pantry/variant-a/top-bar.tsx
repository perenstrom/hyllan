"use client";

// PROTOTYPE (PER-218) — Variant A: dense operator table.

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { hrefWithVariant, type VariantKey } from "@/lib/variant";

export function TopBarA({ variant }: { variant: VariantKey }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <Link
          href={hrefWithVariant("/", variant)}
          className="text-sm font-semibold tracking-tight"
        >
          Your pantry
        </Link>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            render={<Link href={hrefWithVariant("/items/new", variant)} />}
          >
            + Add item
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Account menu"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                />
              }
            >
              PE
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                render={<Link href={hrefWithVariant("/account", variant)} />}
              >
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>Sign out</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmOpen(true);
                }}
              >
                Delete account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately and permanently deletes your pantry and every
              item in it. There is no grace period and this can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDeleted(true);
                setConfirmOpen(false);
              }}
            >
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {deleted && (
        <div className="border-b border-zinc-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-zinc-800 dark:bg-red-950 dark:text-red-300">
          (Prototype) Account and pantry deleted.
        </div>
      )}
    </>
  );
}
