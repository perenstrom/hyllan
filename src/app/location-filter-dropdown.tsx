"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { UNASSIGNED_KEY, type LocationOption } from "@/lib/location";

type Props = {
  locations: LocationOption[];
  hiddenKeys: Set<string>;
  onToggle: (key: string) => void;
};

const PANEL_CLASS =
  "z-10 w-48 rounded-lg border border-zinc-200 bg-white p-2 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900";

// Header-row dropdown offering a checkbox per household location plus
// Unassigned (PER-288) — same Radix Popover pattern as StatusFilterDropdown
// (ADR 0004, PER-251). Filter only: creating a location happens from the
// add-item picker, renaming/deleting from the "Manage locations" page
// linked in the footer below.
export function LocationFilterDropdown({
  locations,
  hiddenKeys,
  onToggle,
}: Props) {
  const total = locations.length + 1; // + Unassigned
  const shown = total - hiddenKeys.size;
  const label =
    hiddenKeys.size === 0 ? "Locations" : `Locations (${shown}/${total})`;

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
          {locations.map((location) => (
            <label
              key={location.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={!hiddenKeys.has(location.id)}
                onChange={() => onToggle(location.id)}
              />
              {location.name}
            </label>
          ))}
          <label className="flex items-center gap-2 rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <input
              type="checkbox"
              checked={!hiddenKeys.has(UNASSIGNED_KEY)}
              onChange={() => onToggle(UNASSIGNED_KEY)}
            />
            Unassigned
          </label>
          <Link
            href="/locations"
            className="mt-1 block rounded border-t border-zinc-100 px-2 pt-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Manage locations →
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
