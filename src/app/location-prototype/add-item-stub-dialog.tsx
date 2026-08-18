"use client";

// PROTOTYPE — wipe me. Answers PER-268's "does add-item pick a location
// immediately, or start unassigned" question: defaults to Unassigned
// (matches "assigning a location is optional throughout", ADR 0005) but
// lets you pick one of the household's locations right away instead, via
// an autocomplete that can also create a new location inline (2026-08-18
// review). Not wired to the real /items/new route or the real add-item
// action — this is a stand-in to react to, not a working form.

import { useState } from "react";

import { LocationPickerCombobox } from "./location-picker-combobox";
import { UNASSIGNED } from "./mock-data";

type Props = {
  locations: string[];
  onCreateLocation: (name: string) => void;
  onClose: () => void;
};

export function AddItemStubDialog({
  locations,
  onCreateLocation,
  onClose,
}: Props) {
  const [location, setLocation] = useState<string>(UNASSIGNED);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
          Add item
        </h2>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <label className="text-zinc-600 dark:text-zinc-400">Name</label>
            <input
              disabled
              placeholder="e.g. Rice"
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-zinc-600 dark:text-zinc-400">
                Quantity
              </label>
              <input
                disabled
                defaultValue={1}
                className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-zinc-600 dark:text-zinc-400">Unit</label>
              <input
                disabled
                defaultValue="count"
                className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-600 dark:text-zinc-400">
              Location (optional)
            </label>
            <LocationPickerCombobox
              locations={locations}
              value={location}
              onChange={setLocation}
              onCreate={onCreateLocation}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled
            className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white opacity-50 dark:bg-zinc-50 dark:text-black"
          >
            Add item (stub)
          </button>
        </div>
      </div>
    </div>
  );
}
