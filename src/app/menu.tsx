"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const MENU_PANEL_CLASS =
  "absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900";

export const MENU_ITEM_CLASS =
  "block w-full px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

type MenuTriggerArgs = { open: boolean; toggle: () => void };
type MenuPanelArgs = { close: () => void };

type Props = {
  // Rendered inside the outside-click boundary; the caller wires its own
  // onClick/aria-expanded to `toggle`/`open` since triggers differ in shape
  // (icon button, labeled button with a count, ...).
  trigger: (args: MenuTriggerArgs) => ReactNode;
  // Panel content, only mounted while open. Receives `close` so items can
  // dismiss the menu after acting (e.g. before navigating).
  children: (args: MenuPanelArgs) => ReactNode;
  panelClassName: string;
  // Checkbox-filled panels (Status filter) aren't a `menu` widget by ARIA;
  // only pass "menu" where the panel actually holds menuitem-role actions.
  panelRole?: "menu";
};

// Shared open-state/outside-click-close/positioning behind the three
// dropdown-style triggers in the app (account menu, status filter, row
// overflow menu) — extracted after the same pattern was hand-rolled
// independently for each one (ADR 0004, PER-266).
export function Menu({ trigger, children, panelClassName, panelRole }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={menuRef} className="relative">
      {trigger({ open, toggle: () => setOpen((current) => !current) })}
      {open && (
        <div role={panelRole} className={panelClassName}>
          {children({ close })}
        </div>
      )}
    </div>
  );
}
