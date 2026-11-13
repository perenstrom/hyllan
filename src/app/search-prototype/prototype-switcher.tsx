"use client";

// PROTOTYPE — wipe me. Floating bottom-bar switcher for PER-400 (search box placement). Hidden in
// production builds so a stray merge can't ship it.

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export type VariantKey = "A" | "B" | "C";

export const VARIANTS: { key: VariantKey; name: string }[] = [
  { key: "A", name: "Own full-width row" },
  { key: "B", name: "Icon that expands" },
  { key: "C", name: "Inline desktop, row mobile" },
];

export function useVariant(): VariantKey {
  const searchParams = useSearchParams();
  const raw = searchParams.get("variant");
  return raw === "B" || raw === "C" ? raw : "A";
}

export function PrototypeSwitcher({ current }: { current: VariantKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const index = VARIANTS.findIndex((v) => v.key === current);

  function go(nextIndex: number) {
    const wrapped = (nextIndex + VARIANTS.length) % VARIANTS.length;
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", VARIANTS[wrapped].key);
    router.replace(`/?${params.toString()}`);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === "ArrowRight") go(index + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="fixed bottom-24 sm:bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-fuchsia-400 bg-black px-4 py-2 text-sm text-white shadow-xl">
      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Previous variant"
        className="px-1"
      >
        ←
      </button>
      <span className="font-medium whitespace-nowrap">
        {current} — {VARIANTS[index].name}
      </span>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Next variant"
        className="px-1"
      >
        →
      </button>
    </div>
  );
}
