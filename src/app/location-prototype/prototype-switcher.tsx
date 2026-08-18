"use client";

// PROTOTYPE — wipe me. Floating bottom-bar switcher for PER-268. Hidden in
// production builds so a stray merge can't ship it.

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export type VariantKey = "A" | "B" | "C";

export const VARIANTS: { key: VariantKey; name: string }[] = [
  { key: "A", name: "Row expansion" },
  { key: "B", name: "Drill-in detail view" },
  { key: "C", name: "Inline popover" },
];

export function useVariant(): VariantKey | null {
  const searchParams = useSearchParams();
  const raw = searchParams.get("variant");
  return raw === "A" || raw === "B" || raw === "C" ? raw : null;
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

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-fuchsia-400 bg-black px-4 py-2 text-sm text-white shadow-xl">
      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Previous variant"
        className="px-1"
      >
        ←
      </button>
      <span className="font-medium">
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
