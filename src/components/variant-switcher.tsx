"use client";

// PROTOTYPE (PER-218) — floating variant switcher, hidden in production builds.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { VARIANTS, resolveVariant } from "@/lib/variant";

export function VariantSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = resolveVariant(searchParams.get("variant") ?? undefined);
  const idx = VARIANTS.findIndex((v) => v.key === current);

  const go = useCallback(
    (dir: 1 | -1) => {
      const next = VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length];
      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", next.key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [idx, pathname, router, searchParams],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (process.env.NODE_ENV === "production") return null;

  const variant = VARIANTS[idx];

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-50 shadow-lg">
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous variant"
        className="rounded-full px-2 py-1 hover:bg-zinc-700"
      >
        ←
      </button>
      <span className="font-medium whitespace-nowrap">
        {variant.key.toUpperCase()} — {variant.label}
      </span>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next variant"
        className="rounded-full px-2 py-1 hover:bg-zinc-700"
      >
        →
      </button>
    </div>
  );
}
