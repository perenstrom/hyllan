"use client";

// PROTOTYPE — wipe me. Three placements for the pantry list's search box
// (PER-400, grilling Q5), switched via ?variant=A|B|C on the real "/" route.
// Each variant owns the whole toolbar region (search + view toggle + both
// filters) so it's free to rearrange it.

import { Search, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

// Word-by-word, case-insensitive substring (grilling Q1): every word in the
// query must appear somewhere in the name, in any order.
export function matchesSearch(name: string, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = name.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

type ToolbarProps = {
  query: string;
  onQueryChange: (next: string) => void;
  toggle: ReactNode;
  filters: ReactNode;
};

const INPUT_CLASS =
  "h-9 w-full rounded border border-zinc-300 bg-white pr-8 pl-8 text-base text-black placeholder:text-zinc-400 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function SearchInput({
  query,
  onQueryChange,
  autoFocus,
  onBlur,
  inputRef,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  autoFocus?: boolean;
  onBlur?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        aria-label="Search pantry items"
        placeholder="Search items"
        value={query}
        autoFocus={autoFocus}
        onBlur={onBlur}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onQueryChange("");
        }}
        className={`${INPUT_CLASS} [&::-webkit-search-cancel-button]:hidden`}
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onQueryChange("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// A: search gets its own full-width row above the toggle/filters row, at
// every screen size.
export function VariantA({
  query,
  onQueryChange,
  toggle,
  filters,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-2 px-4 sm:px-0">
      <SearchInput query={query} onQueryChange={onQueryChange} />
      <div className="flex items-center gap-2 overflow-x-auto sm:overflow-visible">
        <div className="shrink-0">{toggle}</div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {filters}
        </div>
      </div>
    </div>
  );
}

// B: a search icon in the existing toolbar row; tapping it swaps the row
// for a full-width input (on mobile) or expands inline (desktop). It stays
// open while it holds text, so an active search is never invisible.
export function VariantB({
  query,
  onQueryChange,
  toggle,
  filters,
}: ToolbarProps) {
  const [open, setOpen] = useState(query !== "");
  const inputRef = useRef<HTMLInputElement>(null);
  const expanded = open || query !== "";

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 sm:overflow-visible sm:px-0">
      {/* Mobile: the open search replaces the whole row. */}
      <div className={`${expanded ? "hidden sm:block" : ""} shrink-0`}>
        {toggle}
      </div>
      <div
        className="ml-auto flex min-w-0 shrink-0 items-center gap-2 max-sm:data-[open=true]:flex-1"
        data-open={expanded}
      >
        {expanded ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:w-64 sm:flex-none">
            <SearchInput
              query={query}
              onQueryChange={onQueryChange}
              autoFocus={open}
              inputRef={inputRef}
              onBlur={() => {
                if (query === "") setOpen(false);
              }}
            />
            <button
              type="button"
              onClick={() => {
                onQueryChange("");
                setOpen(false);
              }}
              className="shrink-0 text-sm text-zinc-600 sm:hidden dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Search pantry items"
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <Search className="h-4 w-4" />
          </button>
        )}
        <div
          className={`${expanded ? "hidden sm:flex" : "flex"} items-center gap-2`}
        >
          {filters}
        </div>
      </div>
    </div>
  );
}

// C: desktop puts the search box inline in the toolbar row, between the
// toggle and the filters; below sm it drops onto its own row above them.
export function VariantC({
  query,
  onQueryChange,
  toggle,
  filters,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-2 px-4 sm:flex-row sm:items-center sm:px-0">
      <div className="order-1 sm:order-2 sm:w-72">
        <SearchInput query={query} onQueryChange={onQueryChange} />
      </div>
      <div className="order-2 flex items-center gap-2 overflow-x-auto sm:contents">
        <div className="shrink-0 sm:order-1">{toggle}</div>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:order-3">
          {filters}
        </div>
      </div>
    </div>
  );
}

// D: B, but on mobile the search icon sits right-aligned on the "Your
// pantry" title row (free there, since the actions are in the bottom bar),
// and opening it swaps the title for the input — so the toggle/filters row
// never overflows and stays usable while searching. Desktop is unchanged
// from B: the icon expands inline in the toolbar row.
type SearchProps = {
  query: string;
  onQueryChange: (next: string) => void;
};

function SearchIconButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Search pantry items"
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <Search className="h-4 w-4" />
    </button>
  );
}

export function VariantDTitle({
  query,
  onQueryChange,
  title,
}: SearchProps & { title: ReactNode }) {
  const [open, setOpen] = useState(query !== "");
  const expanded = open || query !== "";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className={expanded ? "hidden sm:block" : ""}>{title}</div>
      <div className="ml-auto flex min-w-0 flex-1 justify-end sm:hidden">
        {expanded ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SearchInput
              query={query}
              onQueryChange={onQueryChange}
              autoFocus={open}
              onBlur={() => {
                if (query === "") setOpen(false);
              }}
            />
            <button
              type="button"
              onClick={() => {
                onQueryChange("");
                setOpen(false);
              }}
              className="shrink-0 text-sm text-zinc-600 dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        ) : (
          <SearchIconButton onClick={() => setOpen(true)} />
        )}
      </div>
    </div>
  );
}

function DesktopExpandingSearch({ query, onQueryChange }: SearchProps) {
  const [open, setOpen] = useState(query !== "");
  const expanded = open || query !== "";
  return expanded ? (
    <div className="w-64">
      <SearchInput
        query={query}
        onQueryChange={onQueryChange}
        autoFocus={open}
        onBlur={() => {
          if (query === "") setOpen(false);
        }}
      />
    </div>
  ) : (
    <SearchIconButton onClick={() => setOpen(true)} />
  );
}

export function VariantD({
  query,
  onQueryChange,
  toggle,
  filters,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 sm:overflow-visible sm:px-0">
      <div className="shrink-0">{toggle}</div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="hidden sm:block">
          <DesktopExpandingSearch query={query} onQueryChange={onQueryChange} />
        </div>
        {filters}
      </div>
    </div>
  );
}
