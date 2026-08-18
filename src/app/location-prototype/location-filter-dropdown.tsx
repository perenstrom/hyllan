"use client";

// PROTOTYPE — wipe me. Answers the 2026-08-18 review comment: the header's
// Locations control is a filter, not where locations get created — mirrors
// the real StatusFilterDropdown pattern (ADR 0004, PER-251) rather than
// inventing a new one. Creation moved to the add-item picker
// (location-picker-combobox.tsx); rename/delete moved to the standalone
// manage page (manage/page.tsx), linked from the footer here.

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { UNASSIGNED } from "./mock-data";

type Props = {
  locations: string[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
};

const PANEL_CLASS =
  "z-10 w-48 rounded-lg border border-zinc-200 bg-white p-2 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900";

export function LocationFilterDropdown({ locations, hidden, onToggle }: Props) {
  const total = locations.length + 1; // + Unassigned
  const shown = total - hidden.size;
  const label = hidden.size === 0 ? "Locations" : `Locations (${shown}/${total})`;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className={PANEL_CLASS}>
          {[...locations, UNASSIGNED].map((key) => (
            <label
              key={key}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={!hidden.has(key)}
                onChange={() => onToggle(key)}
              />
              {key === UNASSIGNED ? "Unassigned" : key}
            </label>
          ))}
          <Link
            href="/location-prototype/manage"
            className="mt-1 block rounded border-t border-zinc-100 px-2 pt-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Manage locations →
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
