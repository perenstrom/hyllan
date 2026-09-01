"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// PER-278 prototype infrastructure — see UI.md in the /prototype skill.
// Floating bottom bar that cycles the `?variant=` search param. Gated on
// NODE_ENV so a stray merge to main can't ship this to real users; the
// whole prototype-switcher/variant set is meant to live only on the
// throwaway branch this ticket points at, never on main.
type Props = {
  variants: { key: string; label: string }[];
  current: string;
};

export function PrototypeSwitcher({ variants, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );

  function go(nextIndex: number) {
    const wrapped = (nextIndex + variants.length) % variants.length;
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", variants[wrapped].key);
    router.replace(`?${params.toString()}`);
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
      if (event.key === "ArrowLeft") {
        go(index - 1);
      } else if (event.key === "ArrowRight") {
        go(index + 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const active = variants[index];

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-fuchsia-400 bg-fuchsia-950 px-3 py-2 text-sm text-white shadow-lg shadow-fuchsia-900/40">
      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Previous variant"
        className="rounded-full px-2 py-1 hover:bg-fuchsia-900"
      >
        ←
      </button>
      <span className="font-medium">
        {active.key} — {active.label}
      </span>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Next variant"
        className="rounded-full px-2 py-1 hover:bg-fuchsia-900"
      >
        →
      </button>
    </div>
  );
}
