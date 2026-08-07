"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  activeStatusFilterCount,
  isDefaultStatusFilter,
  type PantryItemStockStatus,
  type PantryStatusFilter,
} from "@/lib/pantry-item";

type Props = {
  filter: PantryStatusFilter;
  onChange: (filter: PantryStatusFilter) => void;
};

const STATUS_OPTIONS: { status: PantryItemStockStatus; label: string }[] = [
  { status: "in-stock", label: "In stock" },
  { status: "low-stock", label: "Low stock" },
  { status: "out-of-stock", label: "Out of stock" },
];

// Header-row dropdown offering the three status checkboxes (ADR 0004,
// PER-251) — mirrors AccountMenu's open/close-on-outside-click pattern,
// the app's existing precedent for this interaction.
export function StatusFilterDropdown({ filter, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Trigger only surfaces a count once the selection isn't the all-checked
  // default (ADR 0004, PER-251) — "Status" alone otherwise.
  const label = isDefaultStatusFilter(filter)
    ? "Status"
    : `Status (${activeStatusFilterCount(filter)}/3)`;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-1 rounded border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-40 rounded-lg border border-zinc-200 bg-white p-2 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {STATUS_OPTIONS.map(({ status, label: optionLabel }) => (
            <label
              key={status}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={filter[status]}
                onChange={(event) =>
                  onChange({ ...filter, [status]: event.target.checked })
                }
              />
              {optionLabel}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
