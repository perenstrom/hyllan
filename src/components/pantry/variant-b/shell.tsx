"use client";

// PROTOTYPE (PER-218) — Variant B: card grid + modal, shared sidebar shell.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hrefWithVariant, type VariantKey } from "@/lib/variant";
import { cn } from "@/lib/utils";

export function ShellB({
  variant,
  children,
}: {
  variant: VariantKey;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItem = (href: string, label: string) => (
    <Link
      href={hrefWithVariant(href, variant)}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium",
        pathname === href
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-1">
      <aside className="flex w-48 flex-col gap-1 border-r border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-4 px-3 text-sm font-semibold tracking-tight">
          Your pantry
        </div>
        {navItem("/", "Pantry")}
        {navItem("/account", "Account")}
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
