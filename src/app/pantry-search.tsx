"use client";

import { Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

// Search on the pantry list (CONTEXT.md "Search", ADR 0004 amendment
// PER-400). The same search shows up in one of two places depending on
// screen width: on the title row below `sm`, in the toolbar row from `sm`
// up. Both are rendered and CSS shows one — they share this state, so the
// query and whether it's open carry across a resize.
type Placement = "title" | "toolbar";

// Tailwind's `sm` breakpoint, for picking which placement `/` should focus.
const SM_MEDIA_QUERY = "(min-width: 40rem)";

// Replace, not push (PER-400): going back from an item's edit page lands
// on the list with the search as it was, and typing doesn't fill the
// history with one entry per keystroke. Next keeps useSearchParams in step
// with native history calls, with no server round trip.
function replaceQueryInUrl(query: string) {
  const url = new URL(window.location.href);
  if (query === "") {
    url.searchParams.delete("q");
  } else {
    url.searchParams.set("q", query);
  }
  window.history.replaceState(null, "", url);
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    ) !== null
  );
}

export type PantrySearch = ReturnType<typeof usePantrySearch>;

// `enabled` is false when the pantry has no items — there's no search
// control then, so `/` has nothing to focus.
export function usePantrySearch({ enabled }: { enabled: boolean }) {
  const searchParams = useSearchParams();
  const [query, setQueryState] = useState(() => searchParams.get("q") ?? "");
  // Which placement the household opened (or focused) the search from, so
  // only that input takes focus on mount, and so clearing a search that
  // was restored from `?q=` doesn't collapse the input under the cursor.
  // Null while collapsed — though a non-empty query keeps the input open
  // regardless, so an active search is never hidden behind the icon.
  const [openedFrom, setOpenedFrom] = useState<Placement | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const toolbarInputRef = useRef<HTMLInputElement>(null);
  const inputRefs: Record<Placement, RefObject<HTMLInputElement | null>> = {
    title: titleInputRef,
    toolbar: toolbarInputRef,
  };
  const expanded = openedFrom !== null || query !== "";

  function setQuery(next: string) {
    setQueryState(next);
    replaceQueryInUrl(next);
  }

  // A keyboard shortcut on the whole document is a subscription to the
  // browser, which is what an Effect is for (CODING_STANDARDS.md).
  useEffect(() => {
    if (!enabled) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.defaultPrevented ||
        isTypingTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      const placement: Placement =
        typeof window.matchMedia === "function" &&
        window.matchMedia(SM_MEDIA_QUERY).matches
          ? "toolbar"
          : "title";
      const input = (placement === "toolbar" ? toolbarInputRef : titleInputRef)
        .current;
      if (input) {
        input.focus();
      } else {
        setOpenedFrom(placement);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);

  function fieldProps(placement: Placement): SearchFieldProps {
    return {
      query,
      onQueryChange: setQuery,
      inputRef: inputRefs[placement],
      autoFocus: openedFrom === placement,
      onOpen: () => setOpenedFrom(placement),
      onCollapse: () => setOpenedFrom(null),
    };
  }

  return {
    enabled,
    query,
    expanded,
    open: (placement: Placement) => setOpenedFrom(placement),
    cancel: () => {
      setQuery("");
      setOpenedFrom(null);
    },
    fieldProps,
  };
}

type SearchFieldProps = {
  query: string;
  onQueryChange: (next: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  autoFocus: boolean;
  onOpen: () => void;
  onCollapse: () => void;
};

const SEARCH_LABEL = "Search pantry items";

// text-base below sm so iOS Safari doesn't zoom on focus (ADR 0004, mobile
// rework). The browser's own clear button is hidden in favour of the ✕
// below, which looks the same everywhere.
const INPUT_CLASS =
  "h-9 w-full rounded border border-zinc-300 bg-white pr-8 pl-8 text-base text-black placeholder:text-zinc-400 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 [&::-webkit-search-cancel-button]:hidden";

function SearchField({
  query,
  onQueryChange,
  inputRef,
  autoFocus,
  onOpen,
  onCollapse,
}: SearchFieldProps) {
  return (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        aria-label={SEARCH_LABEL}
        placeholder="Search items"
        autoComplete="off"
        value={query}
        // Only ever true right after the household opened the search
        // themselves (the icon, or `/`), never on page load.
        autoFocus={autoFocus}
        onChange={(event) => onQueryChange(event.target.value)}
        onFocus={onOpen}
        onBlur={(event) => {
          if (event.currentTarget.value === "") {
            onCollapse();
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") {
            return;
          }
          event.preventDefault();
          if (query !== "") {
            onQueryChange("");
          } else {
            event.currentTarget.blur();
          }
        }}
        className={INPUT_CLASS}
      />
      {query !== "" && (
        <button
          type="button"
          aria-label="Clear search"
          // Keeps focus in the input, so clearing doesn't also collapse it.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            // Focus first: it marks the search as open, so emptying the
            // query doesn't collapse the input.
            inputRef.current?.focus();
            onQueryChange("");
          }}
          className="absolute top-1/2 right-1 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function SearchIconButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={SEARCH_LABEL}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

// Below sm: the icon sits right-aligned on the "Your pantry" title row —
// free there, since the primary actions live in the pinned bottom bar —
// and the open search replaces the title, leaving the toggle and filters
// row untouched. From sm up only the title shows here.
export function PantrySearchTitleRow({
  search,
  title,
}: {
  search: PantrySearch;
  title: ReactNode;
}) {
  const { enabled } = search;
  const showField = enabled && search.expanded;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className={showField ? "hidden sm:block" : ""}>{title}</div>
      {enabled && (
        <div className="ml-auto flex min-w-0 flex-1 justify-end sm:hidden">
          {showField ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SearchField {...search.fieldProps("title")} />
              <button
                type="button"
                // Keeps the input's blur from collapsing the row before
                // the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={search.cancel}
                className="shrink-0 text-sm text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
            </div>
          ) : (
            <SearchIconButton onClick={() => search.open("title")} />
          )}
        </div>
      )}
    </div>
  );
}

// From sm up: the icon sits in the toolbar row before the filters and
// expands in place into an inline input.
export function PantrySearchToolbarControl({
  search,
}: {
  search: PantrySearch;
}) {
  return (
    <div className="hidden sm:block">
      {search.expanded ? (
        <div className="w-64">
          <SearchField {...search.fieldProps("toolbar")} />
        </div>
      ) : (
        <SearchIconButton onClick={() => search.open("toolbar")} />
      )}
    </div>
  );
}
