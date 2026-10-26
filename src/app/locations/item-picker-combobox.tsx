"use client";

import { useState } from "react";

import { LISTBOX_OPTION_CLASS } from "@/app/listbox-styles";
import { useListboxNavigation } from "@/app/use-listbox-navigation";

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

  const { inputProps, listboxProps, optionProps } = useListboxNavigation({
    optionCount: matches.length,
    open,
    query,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    onActivate: (index) => select(matches[index]),
  });

  return (
    <div className="relative">
      <input
        {...inputProps}
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
        className="h-11 w-full rounded border border-zinc-300 bg-white px-3 sm:h-10 dark:border-zinc-700 dark:bg-zinc-900"
      />

      {open && (
        <ul
          {...listboxProps}
          className="absolute top-full z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          {matches.map((item, index) => (
            <li
              key={item.id}
              {...optionProps(index)}
              onMouseDown={() => select(item)}
              className={LISTBOX_OPTION_CLASS}
            >
              {item.name}
            </li>
          ))}
          {matches.length === 0 && (
            <li
              role="presentation"
              className="px-3 py-1.5 text-zinc-500 dark:text-zinc-500"
            >
              No matches
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
