"use client";

// PROTOTYPE — wipe me. Shared header bar across all three variants — same
// allowance as sharing a real <Header>, per the prototype skill.

import { useState } from "react";

import { AddItemStubDialog } from "./add-item-stub-dialog";
import { LocationFilterDropdown } from "./location-filter-dropdown";

type Props = {
  locations: string[];
  hiddenLocations: Set<string>;
  onToggleLocation: (key: string) => void;
  onCreateLocation: (name: string) => void;
};

export function PrototypeHeader({
  locations,
  hiddenLocations,
  onToggleLocation,
  onCreateLocation,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex items-center justify-between px-2 sm:px-0">
      <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
        Your pantry
      </h1>
      <div className="flex items-center gap-2">
        <LocationFilterDropdown
          locations={locations}
          hidden={hiddenLocations}
          onToggle={onToggleLocation}
        />
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
        >
          + Add item
        </button>
      </div>
      {addOpen && (
        <AddItemStubDialog
          locations={locations}
          onCreateLocation={onCreateLocation}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
