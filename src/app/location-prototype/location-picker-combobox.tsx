"use client";

// PROTOTYPE — wipe me. Answers the 2026-08-18 review comment: add-item's
// location field is a filtering autocomplete, not a <select>, with an
// inline "Add '<name>' as new location" affordance when the typed text
// doesn't match anything — this is now the only place a location gets
// created in this prototype (the header dropdown is filter-only, see
// location-filter-dropdown.tsx). No keyboard-arrow navigation — cheap and
// rough, per the prototype skill; click-only is enough to react to.

import { useState } from "react";

import { UNASSIGNED } from "./mock-data";

type Props = {
  locations: string[];
  value: string; // a location name, or UNASSIGNED
  onChange: (value: string) => void;
  onCreate: (name: string) => void;
};

export function LocationPickerCombobox({
  locations,
  value,
  onChange,
  onCreate,
}: Props) {
  const [query, setQuery] = useState(
    value === UNASSIGNED ? "Unassigned" : value,
  );
  const [open, setOpen] = useState(false);

  const trimmed = query.trim();
  const matches = [
    "Unassigned",
    ...locations,
  ].filter((option) => option.toLowerCase().includes(trimmed.toLowerCase()));
  const exactMatch = matches.some(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = trimmed.length > 0 && !exactMatch;

  function select(name: string) {
    setQuery(name);
    onChange(name === "Unassigned" ? UNASSIGNED : name);
    setOpen(false);
  }

  function create() {
    onCreate(trimmed);
    select(trimmed);
  }

  return (
    <div className="relative">
      <input
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
        className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
      />
      {open && (
        <ul className="absolute top-full z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {matches.map((option) => (
            <li key={option}>
              <button
                type="button"
                onMouseDown={() => select(option)}
                className="block w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {option}
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                onMouseDown={create}
                className="block w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Add “{trimmed}” as new location
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
    </div>
  );
}
