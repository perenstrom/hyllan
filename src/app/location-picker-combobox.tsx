"use client";

import { useState, useTransition } from "react";

import { createLocation } from "./locations/actions";
import type { LocationOption } from "@/lib/location";

const UNASSIGNED_LABEL = "Unassigned";
const UNASSIGNED_OPTION = { id: null as string | null, name: UNASSIGNED_LABEL };

type Props = {
  id?: string;
  locations: LocationOption[];
  value: string | null;
  onChange: (locationId: string | null) => void;
  onLocationCreated: (location: LocationOption) => void;
};

// Add/edit-item's "Location (optional)" field (PER-288): a filtering
// autocomplete, not a <select>, with an inline "Add '<text>' as new
// location" option when the typed text matches nothing — this is the only
// place besides the manage-locations page a location gets created. Submits
// through a hidden `locationId` input (empty string for Unassigned,
// resolved to null by parsePantryItemInput) rather than the visible search
// text, so the item form's action never sees the display name.
export function LocationPickerCombobox({
  id,
  locations,
  value,
  onChange,
  onLocationCreated,
}: Props) {
  const selectedName =
    value === null
      ? UNASSIGNED_LABEL
      : (locations.find((location) => location.id === value)?.name ??
        UNASSIGNED_LABEL);
  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmed = query.trim();
  const options = [UNASSIGNED_OPTION, ...locations];
  const matches = options.filter((option) =>
    option.name.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const exactMatch = options.some(
    (option) => option.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = trimmed.length > 0 && !exactMatch;

  function select(option: { id: string | null; name: string }) {
    setQuery(option.name);
    onChange(option.id);
    setOpen(false);
  }

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createLocation(trimmed);
      if (result.ok) {
        onLocationCreated(result.location);
        select(result.location);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="relative">
      <input
        id={id}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={(event) => {
          // Selects the current value so typing replaces it outright —
          // without this, focusing the field and typing appends onto
          // whatever's already there (e.g. the "Unassigned" default).
          event.target.select();
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        placeholder="Search or add a location"
        autoComplete="off"
        className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input type="hidden" name="locationId" value={value ?? ""} />

      {open && (
        <ul className="absolute top-full z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {matches.map((option) => (
            <li key={option.id ?? "unassigned"}>
              <button
                type="button"
                onMouseDown={() => select(option)}
                className="block w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {option.name}
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                onMouseDown={create}
                disabled={isPending}
                className="block w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Add &ldquo;{trimmed}&rdquo; as new location
              </button>
            </li>
          )}
          {matches.length === 0 && !canCreate && (
            <li className="px-3 py-1.5 text-zinc-500 dark:text-zinc-500">
              No matches
            </li>
          )}
        </ul>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
