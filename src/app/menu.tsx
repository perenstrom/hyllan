"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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

// Shared open-state/outside-click-close/positioning, extracted after the
// same pattern was hand-rolled independently across the app's three
// dropdown-style triggers (ADR 0004, PER-266). The account menu and the row
// overflow menu have since moved onto Radix's DropdownMenu primitive
// instead (ADR 0004, PER-270), for portal-based positioning and standard
// menu keyboard behavior; this primitive remains for the Status filter
// dropdown, whose checkbox panel isn't an ARIA `menu` widget and wasn't in
// scope for that migration.
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
