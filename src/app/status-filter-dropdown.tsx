"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";

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

const PANEL_CLASS =
  "z-10 w-40 rounded-lg border border-zinc-200 bg-white p-2 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900";

// Header-row dropdown offering the three status checkboxes (ADR 0004,
// PER-251). Built on Radix's Popover primitive (ADR 0004, PER-271) rather
// than a menu primitive — the panel holds checkboxes, not menuitems, so it
// isn't an ARIA `menu` widget and Popover (not DropdownMenu) is Radix's
// primitive for a non-menu floating panel.
export function StatusFilterDropdown({ filter, onChange }: Props) {
  // Trigger only surfaces a count once the selection isn't the all-checked
  // default (ADR 0004, PER-251) — "Status" alone otherwise.
  const label = isDefaultStatusFilter(filter)
    ? "Status"
    : `Status (${activeStatusFilterCount(filter)}/3)`;

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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
