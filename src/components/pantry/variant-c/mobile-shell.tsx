"use client";

// PROTOTYPE (PER-218) — Variant C: mobile-first shell (narrow viewport, hamburger menu).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AccountContentC } from "./account-content";

export function MobileShellC({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col border-x border-zinc-200 dark:border-zinc-800">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="text-sm font-semibold tracking-tight">
          Your pantry
        </span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Menu"
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </Button>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-full sm:max-w-full">
          <SheetTitle className="sr-only">Account</SheetTitle>
          <AccountContentC />
        </SheetContent>
      </Sheet>
    </div>
  );
}
