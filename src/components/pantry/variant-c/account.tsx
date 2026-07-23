"use client";

// PROTOTYPE (PER-218) — Variant C: account as a full page (same content as the hamburger sheet).

import { MobileShellC } from "./mobile-shell";
import { AccountContentC } from "./account-content";

export function AccountC() {
  return (
    <MobileShellC>
      <AccountContentC />
    </MobileShellC>
  );
}
