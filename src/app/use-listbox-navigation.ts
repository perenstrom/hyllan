"use client";

import { useEffect, useId, useState } from "react";

type Options = {
  // Every selectable row, create rows included, in display order. Status
  // rows like "No matches" aren't options and don't count.
  optionCount: number;
  // Whether the popup is actually showing, not just "wants to be open".
  open: boolean;
  // The input's text; any change to it clears the highlight.
  query: string;
  onOpen: () => void;
  onClose: () => void;
  // Does whatever clicking option `index` does.
  onActivate: (index: number) => void;
};

// Keyboard and ARIA behaviour shared by the popup autocompletes
// (BatchEntryRow, LocationPickerCombobox, ItemPickerCombobox; PER-321).
// Hand-rolled because Radix has no combobox. Focus stays in the input and
// the highlight is announced through aria-activedescendant. The hook owns
// the rules the three must agree on: Enter is only taken when something is
// highlighted, and Escape only when the popup is open — so a closed popup
// lets Escape reach a surrounding <dialog>, and an unhighlighted Enter
// keeps doing whatever the component or its form did before.
export function useListboxNavigation({
  optionCount,
  open,
  query,
  onOpen,
  onClose,
  onActivate,
}: Options) {
  const listboxId = useId();
  // What the arrows last set; `highlighted` below is what's in effect.
  const [storedHighlight, setStoredHighlight] = useState<number | null>(null);
  const [previousQuery, setPreviousQuery] = useState(query);

  // Reset during render rather than in an effect, so a stale highlight is
  // never painted (or activated) for the new text or a reopened popup.
  if (query !== previousQuery) {
    setPreviousQuery(query);
    setStoredHighlight(null);
  }
  if (!open && storedHighlight !== null) {
    setStoredHighlight(null);
  }

  const highlighted =
    open && storedHighlight !== null && storedHighlight < optionCount
      ? storedHighlight
      : null;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  useEffect(() => {
    if (highlighted !== null) {
      // jsdom has no scrollIntoView.
      document
        .getElementById(optionId(highlighted))
        ?.scrollIntoView?.({ block: "nearest" });
    }
    // optionId only depends on listboxId, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted]);

  function onKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          onOpen();
        } else if (optionCount > 0) {
          setStoredHighlight(
            highlighted === null
              ? 0
              : Math.min(highlighted + 1, optionCount - 1),
          );
        }
        break;
      case "ArrowUp":
        if (open) {
          event.preventDefault();
          setStoredHighlight(
            highlighted === null || highlighted === 0 ? null : highlighted - 1,
          );
        }
        break;
      case "Enter":
        if (highlighted !== null) {
          event.preventDefault();
          onActivate(highlighted);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        break;
    }
  }

  return {
    inputProps: {
      role: "combobox" as const,
      "aria-expanded": open,
      "aria-controls": listboxId,
      "aria-autocomplete": "list" as const,
      "aria-activedescendant":
        highlighted === null ? undefined : optionId(highlighted),
      onKeyDown,
    },
    listboxProps: { id: listboxId, role: "listbox" as const },
    // A disabled option can still be highlighted; onActivate decides what
    // activating it does (LocationPickerCombobox's pending create).
    optionProps: (index: number, { disabled = false } = {}) => ({
      id: optionId(index),
      role: "option" as const,
      "aria-selected": index === highlighted,
      "aria-disabled": disabled || undefined,
    }),
  };
}
