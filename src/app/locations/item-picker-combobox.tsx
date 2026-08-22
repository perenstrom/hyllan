"use client";

import { useState } from "react";

export type ItemPickerOption = { id: string; name: string };

type Props = {
  id?: string;
  items: ItemPickerOption[];
  value: string | null;
  onChange: (itemId: string) => void;
};

// Shelf-to-stock's item picker (PER-265): a filtering autocomplete over the
// household's existing pantry items only — unlike LocationPickerCombobox,
// there is no "create new" branch, since creating a brand-new pantry item
// stays structurally out of reach here (ticket's "Out of scope"), not just
// validated against after the fact.
export function ItemPickerCombobox({ id, items, value, onChange }: Props) {
  const selectedName = items.find((item) => item.id === value)?.name ?? "";
  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);

  const trimmed = query.trim();
  const matches = items.filter((item) =>
    item.name.toLowerCase().includes(trimmed.toLowerCase()),
  );

  function select(item: ItemPickerOption) {
    setQuery(item.name);
    onChange(item.id);
    setOpen(false);
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
          event.target.select();
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        placeholder="Search for an item"
        autoComplete="off"
        className="h-10 w-full rounded border border-zinc-300 px-3 dark:border-zinc-700 dark:bg-zinc-900"
      />

      {open && (
        <ul className="absolute top-full z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={() => select(item)}
                className="block w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {item.name}
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-3 py-1.5 text-zinc-500 dark:text-zinc-500">
              No matches
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
