# Research: Component library choice for Hyllan's UI

**Ticket:** none — direct research request, not filed against a specific Linear issue

**Scope:** The MVP spec (PER-212) locked the stack as "TypeScript, Next.js, Postgres, shadcn/ui," and PER-218's core-screen prototypes used shadcn/ui components for the mockups. Neither was ever carried into the real app: `package.json` has no Radix, Base UI, or shadcn dependency, and every component under `src/app/` (`app-header.tsx`, `account-menu.tsx`, `delete-account-dialog.tsx`, `item-form.tsx`, `signed-in-home.tsx`) is hand-rolled React + Tailwind, including a native `<dialog>` for the one modal the app has. This note re-opens the question now that it's time to actually build the real UI: given Hyllan's locked, deliberately minimal MVP scope (ADR 0004 — one dense table list, one add/edit form, one avatar dropdown, one confirmation dialog) and its existing Tailwind v4 commitment, which component-library approach — shadcn/ui, Radix UI primitives used directly, Headless UI, React Aria Components, or continuing hand-rolled — actually fits, evaluated on footprint, accessibility, maintenance status, and scope/coverage.

---

## 1. Recommendations (summary)

| Axis / Question | Recommendation |
|---|---|
| Overall approach | No general-purpose component library. Keep the table and the delete-account dialog exactly as hand-rolled today; add **Radix UI's `@radix-ui/react-dropdown-menu` primitive directly** (no shadcn/ui layer) for just the account menu, the one place the current code has a real, fixable accessibility gap. |
| shadcn/ui | Skip. It is a copy-paste code distribution, not an installable dependency — Hyllan would still have to pick an underlying primitive (Radix or Base UI, and shadcn made Base UI the default over Radix as of July 2026, while Base UI itself is still pre-1.0 on npm) for value it doesn't need at a 3-screen MVP scope. |
| Radix UI primitives (direct) | Adopt narrowly — just the dropdown-menu primitive, as a real, scoped, tree-shakeable npm dependency, for the one component that actually needs library-grade keyboard/focus behavior. |
| Headless UI | Skip for now. Functionally comparable to Radix for Hyllan's needs, but its own release history shows a visibly slower cadence (latest `@headlessui/react` release ~4 months old vs. Radix's ~2 weeks at time of writing). |
| React Aria Components | Skip for now. The most rigorously documented accessibility testing and the broadest component coverage of the four (form fields, table, date pickers, 50+ components) — but that breadth isn't needed yet. Reasonable to reach for later if Hyllan's scope grows past plain HTML forms and a static list. |
| Hand-rolled forms | Keep as-is. Native `<input>`/`<select>` + `<label htmlFor>` (`item-form.tsx`) is already the textbook accessible pattern; nothing in the locked MVP scope exceeds it. |
| Hand-rolled dialog | Keep as-is. Native `<dialog>` + `showModal()` (`delete-account-dialog.tsx`) already gives a focus-trapped, Escape-to-close, semantically-modal dialog for free — the same behavioral guarantee every library's Dialog primitive would add, at zero dependency cost. |
| Hand-rolled dense table | Keep as-is. None of the four libraries ship meaningful *behavior* for a plain, non-sortable, non-virtualized list — even shadcn/ui's own "Table" component is unstyled native `<table>` tags with Tailwind classes and no primitive underneath it at all. |
| Account menu dropdown | This is the one real gap. `account-menu.tsx` closes on outside-click but has no `Escape`-to-close handler and no arrow-key roving focus between menu items — exactly the behavior a `DropdownMenu`/`Menu` primitive gives out of the box. |

Detail and sourcing for each below.

---

## 2. What Hyllan already hand-rolls today

Before comparing libraries, it's worth being precise about what "hand-rolled" currently means in this codebase, since two of the three UI surfaces already work well without any library:

- **The dialog** (`src/app/delete-account-dialog.tsx`): a native `<dialog>` element driven by `showModal()`/`close()` in a `useEffect`, with the component's own comment recording the reasoning: "A native `<dialog>` gives us a focus-trapped, Esc-to-close modal without pulling in a component library." This is a real, browser-native accessible modal — no library needed.
- **The forms** (`src/app/items/item-form.tsx`): plain `<label htmlFor>` + native `<input>`/`<select>`, with `useActionState` for pending/error state. No custom widgets (no combobox, no date picker, no async validation) — the textbook accessible form pattern, requiring no library.
- **The dense table** (`src/app/signed-in-home.tsx`): a plain `<table>`/`<thead>`/`<tbody>` with Tailwind classes, exactly matching the "single flat table" ADR 0004 locked in.
- **The account menu** (`src/app/account-menu.tsx`): a custom `useState` + `useRef` dropdown. It closes on outside-click via a `mousedown` listener, and has `role="menu"`/`role="menuitem"` attributes — but **no `Escape`-key handler and no arrow-key roving-tabindex focus movement between items**, both of which are part of the WAI-ARIA Menu Button pattern that a Menu/DropdownMenu primitive implements by default. This is the one concrete, currently-shipping accessibility gap in the app.

That inventory drives most of the scope/coverage analysis below: two of Hyllan's three UI surfaces are already solved without a library, and the third has an identifiable, narrow gap rather than a wholesale missing capability.

---

## 3. Footprint

**shadcn/ui** is explicitly not an npm dependency. Its own docs state: "This is not a component library. It is how you build your component library... you do not install it as a dependency. It is not available or distributed via npm." ([shadcn/ui: Introduction](https://ui.shadcn.com/docs)) In practice, the `shadcn` CLI package itself (`npx shadcn add <component>`) is what's on npm — its own registry description is simply "Add components to your apps" — and running it copies component source files straight into the repo rather than adding a versioned runtime dependency for the components themselves. ([npm registry: `shadcn`](https://www.npmjs.com/package/shadcn)) The real footprint cost is whatever the *copied* component code imports: as of shadcn/ui's own architecture today, a copied `Dialog` component imports `Dialog as DialogPrimitive from "radix-ui"` (the unified Radix package) plus `lucide-react` for its close icon ([`shadcn-ui/ui`: `dialog.tsx`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/dialog.tsx)), while a copied `Table` component imports nothing beyond React and a local `cn()` class-merge helper — it's plain native `<table>` tags with Tailwind classes, no primitive library at all ([`shadcn-ui/ui`: `table.tsx`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/table.tsx)). Because the code is copied rather than installed, there is also no ongoing version-bump path — once copied, a component only changes if you edit it yourself or manually re-run the CLI against a newer registry version.

**Radix UI primitives used directly** are real, versioned npm dependencies. Radix ships both granular scoped packages (e.g. `@radix-ui/react-dialog`, latest `1.1.23`) and, as of a February 2026 consolidation that shadcn/ui itself now builds on, a single unified `radix-ui` package (latest `1.6.7`) that bundles every primitive behind one dependency, relying on bundler tree-shaking to drop what isn't imported ([npm registry: `@radix-ui/react-dialog`](https://registry.npmjs.org/@radix-ui/react-dialog), [npm registry: `radix-ui`](https://registry.npmjs.org/radix-ui)). Installing only the one scoped package Hyllan actually needs (`@radix-ui/react-dropdown-menu`) keeps the dependency surface to exactly that primitive rather than the whole suite.

**Headless UI** is a single real npm dependency, `@headlessui/react` (latest `2.2.10`), described on npm as "A set of completely unstyled, fully accessible UI components for React, designed to integrate beautifully with Tailwind CSS" — no granular per-primitive packages, just the one package with tree-shakeable exports. ([npm registry: `@headlessui/react`](https://registry.npmjs.org/@headlessui/react))

**React Aria Components** is likewise a single real dependency, `react-aria-components` (latest `1.20.0`), covering "Over 50 components with built-in behavior, adaptive interactions, top-tier accessibility, and internationalization out of the box" ([`adobe/react-spectrum`: `react-aria-components` package](https://github.com/adobe/react-spectrum/tree/main/packages/react-aria-components)) — the largest surface area of the four, and correspondingly the largest potential dependency graph underneath (React Aria's hooks + React Stately state management), though it is designed to be imported piecemeal and tree-shaken.

**Hand-rolled** costs nothing beyond what's already in `package.json` — confirmed by inspection: no Radix, Base UI, Headless UI, or React Aria entry exists in `dependencies` today, and the app's own `icons.tsx` inlines four small SVGs rather than adding an icon library "for four glyphs," per that file's own comment.

---

## 4. Accessibility

**shadcn/ui** does not itself publish independent accessibility guarantees — its accessibility is entirely a pass-through of whichever primitive layer a given copied component is built on (Radix or, as of shadcn's July 2026 default switch, Base UI). Its own marketing copy calls its components "beautifully-designed, accessible components," but the actual keyboard/ARIA/focus mechanics live in the underlying primitive's code, which is copied in at generation time and then becomes Hyllan's own code to maintain — including any future upstream accessibility fixes, which do not arrive automatically once copied.

**Radix UI Primitives'** own accessibility page states the components "follow the WAI-ARIA authoring practices guidelines and are tested in a wide selection of modern browsers and commonly used assistive technologies," and that WAI-ARIA "specifies the semantics for many common UI patterns that show up in Radix Primitives, designed to provide meaning for controls that aren't built using elements provided by the browser." It further documents that specific components implement specific WAI-ARIA patterns with concrete mechanics — e.g., the Menubar and Radio Group components "use roving tabindex to manage focus movement among menu items" — exactly the pattern missing from Hyllan's current hand-rolled account menu. ([Radix Primitives: Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility))

**Headless UI's** own description states it provides "completely unstyled, fully accessible UI components," managing "ARIA attributes, focus trapping, keyboard handling, and portal rendering" so that only markup and styling are left to the developer, with components described as WAI-ARIA compliant across its Menu, Listbox, Combobox, Switch, Dialog, Tabs, and related components. ([Headless UI homepage](https://headlessui.com/), [npm registry: `@headlessui/react`](https://registry.npmjs.org/@headlessui/react))

**React Aria Components** publishes the most rigorous, testing-specific accessibility claims of the four. Its own docs state components are "tested across a wide variety of devices, browsers, and screen readers," specifically calling out "NVDA, JAWS, VoiceOver on macOS and iOS, TalkBack on Android — across multiple browsers," that the library "supplies the correct semantics via ARIA roles and attributes, handles keyboard and pointer events, manages focus, and provides screen reader announcements," and that "all behaviors work without a keyboard, ensuring touch screen reader users have full access" ([React Aria: Accessibility / Quality](https://react-spectrum.adobe.com/react-aria/accessibility.html)). This is the only one of the four whose own docs name specific assistive-technology/browser combinations tested rather than a general "fully accessible" claim.

**Hand-rolled (Hyllan today)** is a genuine mixed bag rather than a uniform risk: the delete-account dialog gets real, free accessibility from the platform itself — `<dialog>`'s native `showModal()` provides a focus trap, `Escape`-to-close, and implicit modal semantics with zero library code, matching what any of the four libraries' Dialog primitive would add. The account menu, by contrast, demonstrably under-delivers: it lacks the `Escape`-to-close and roving-tabindex arrow-key navigation that the WAI-ARIA Menu Button pattern calls for and that Radix, Headless UI, and React Aria's Menu/DropdownMenu components all implement by default (`src/app/account-menu.tsx`, current implementation).

---

## 5. Maintenance status

| Library | Primary maintainer | Latest version (npm) | Published | Notes |
|---|---|---|---|---|
| shadcn/ui (CLI) | shadcn, under the `shadcn-ui` GitHub org | `shadcn@4.16.1` | 2026-07-31 | ~120k GitHub stars ([`shadcn-ui/ui`](https://github.com/shadcn-ui/ui)); package created 2024-07-09, actively released. |
| Radix UI Primitives | WorkOS (acquired original creator Modulz in 2022) | `@radix-ui/react-dialog@1.1.23`; unified `radix-ui@1.6.7` | 2026-07-24 | ~19k GitHub stars. GitHub's own repo tagline: "Radix Primitives is an open-source UI component library for building high-quality, accessible design systems and web apps. Maintained by @workos." ([`radix-ui/primitives`](https://github.com/radix-ui/primitives)) |
| Headless UI | Tailwind Labs | `@headlessui/react@2.2.10` | 2026-04-07 | ~28.7k GitHub stars ([`tailwindlabs/headlessui`](https://github.com/tailwindlabs/headlessui)). Noticeably slower release cadence than the other three — latest release is ~4 months old as of this research, versus ~2 weeks for Radix and React Aria Components. |
| React Aria Components | Adobe (`adobe/react-spectrum` monorepo) | `react-aria-components@1.20.0` | 2026-07-31 | ~15.8k GitHub stars ([`adobe/react-spectrum`](https://github.com/adobe/react-spectrum)). Adobe dogfoods it for its own Spectrum design system, which reduces (but doesn't eliminate) single-vendor abandonment risk. |
| Base UI (relevant because it's shadcn/ui's new default) | MUI team, "from the creators of Radix, Floating UI, and Material UI" | `@base-ui-components/react@1.0.0-rc.0` | 2025-12-04 | Still a release candidate, not yet a stable 1.0, as of this research — a real caveat for anyone adopting shadcn/ui today expecting a stable underlying primitive. ([`mui/base-ui`](https://github.com/mui/base-ui)) |

The one signal worth surfacing explicitly: shadcn/ui itself has been in active architectural flux through 2026 — its own changelog documents a February 2026 move to a single unified `radix-ui` npm package, then a July 2026 change making **Base UI the new default** underlying primitive for new projects (with Radix "still fully supported," not deprecated) ([shadcn/ui changelog index](https://ui.shadcn.com/docs/changelog)). That means components copied from shadcn/ui today may be structurally different from components copied even a few months ago, and the newly-default underlying primitive (Base UI) is itself still pre-1.0 on npm. This is exactly the kind of churn a single-developer MVP wants to avoid depending on.

---

## 6. Scope/coverage against Hyllan's locked MVP scope

ADR 0004 locks three UI surfaces: a dense table list, a focused add/edit form, and an avatar-triggered account menu with a delete-account confirmation dialog. Mapping each against what these libraries actually ship as *behavior* (not just styling):

- **Dense table/list**: none of the four libraries add meaningful behavioral value here for Hyllan's specific need. Hyllan's table has no sorting, selection, or virtualization requirement — it's a static list with row-scoped action buttons (ADR 0004's "single flat table," refined further in the PER-232/PER-236 amendments for touch targets and out-of-stock styling). React Aria Components does ship a genuine `Table` primitive with sort/selection behavior, and shadcn/ui ships a "Table" component — but that shadcn component, inspected directly, is unstyled native `<table>`/`<thead>`/`<tbody>` tags with Tailwind classes and no Radix or Base UI primitive underneath at all ([`shadcn-ui/ui`: `table.tsx`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/table.tsx)) — i.e., shadcn/ui's own authors agree a plain table needs no behavior library. Hyllan's existing hand-rolled table already matches this.

- **Dialog**: Radix, Base UI, Headless UI, and React Aria Components all ship a Dialog/Modal primitive with focus trapping and ARIA dialog semantics out of the box — but Hyllan's existing native `<dialog>` implementation already provides the same guarantee at zero dependency cost (§4). Adopting a library here would mean trading a working zero-dependency solution for a larger one with no behavioral upgrade.

- **Forms/inputs**: none of the four ship anything beyond wrapping native `<input>`/`<select>` with additional ARIA-state plumbing meant for richer widgets (comboboxes, date pickers, async-validated fields) that Hyllan's locked scope (name/quantity/unit) doesn't need. React Aria Components has the deepest form-adjacent primitive set of the four if Hyllan ever adds such a widget, but nothing in the current MVP scope calls for it.

- **Account menu / dropdown**: this is the one surface where a primitive earns its keep. Radix's `DropdownMenu`, Base UI's `Menu`, Headless UI's `Menu`, and React Aria Components' `Menu` all implement the WAI-ARIA Menu Button pattern — `Escape`-to-close and roving-tabindex arrow-key navigation among items — which Hyllan's current hand-rolled implementation is missing (§2, §4).

---

## 7. Final recommendation

Given a self-hosted, single-developer-maintained MVP that is deliberately minimal in scope (CONTEXT.md: single-user households, no invite flow, no settings beyond sign-out/delete-account) and already committed to Tailwind v4, the right call is **not** to adopt a general-purpose component library. Two of Hyllan's three UI surfaces are already correctly and completely solved with zero dependencies — the native `<dialog>` for the confirmation modal and plain labeled `<input>`/`<select>` for the form — and none of shadcn/ui, Radix, Headless UI, or React Aria Components would improve on either; shadcn/ui's own bundled Table component proves the same is true for the dense list.

The one real gap — the account menu's missing `Escape`-to-close and roving-tabindex behavior — is narrow enough to fix with a single, scoped, directly-installed dependency rather than a library layer: **`@radix-ui/react-dropdown-menu`**, installed directly (no shadcn/ui copy-paste step in between). Radix is preferred over Headless UI here on maintenance-cadence grounds (§5: ~2-week-old latest release vs. Headless UI's ~4-month-old one) and over React Aria Components on scope grounds (its 50+-component breadth is more than a single dropdown menu needs). shadcn/ui specifically is skipped because its entire value proposition — a large, consistent, on-brand set of dozens of pre-styled components — doesn't pay off at a 3-screen MVP, and it would additionally saddle Hyllan with a decision (Radix vs. its new, still-pre-1.0 Base UI default) that a single targeted Radix install avoids entirely.

If Hyllan's scope grows later — a real sortable/filterable table, comboboxes, date pickers, or a second form-heavy screen — React Aria Components is the strongest reach candidate given its documented accessibility rigor and component breadth (§4, §6).

---

## Sources

- [shadcn/ui: Introduction](https://ui.shadcn.com/docs)
- [shadcn/ui: changelog index](https://ui.shadcn.com/docs/changelog)
- [npm registry: `shadcn`](https://www.npmjs.com/package/shadcn) / [raw registry data](https://registry.npmjs.org/shadcn)
- [`shadcn-ui/ui` GitHub repository](https://github.com/shadcn-ui/ui)
- [`shadcn-ui/ui`: `dialog.tsx`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/dialog.tsx)
- [`shadcn-ui/ui`: `table.tsx`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/table.tsx)
- [Radix Primitives: Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [Radix Primitives: Introduction](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [`radix-ui/primitives` GitHub repository](https://github.com/radix-ui/primitives)
- [npm registry: `@radix-ui/react-dialog`](https://registry.npmjs.org/@radix-ui/react-dialog)
- [npm registry: `radix-ui` (unified package)](https://registry.npmjs.org/radix-ui)
- [Headless UI homepage](https://headlessui.com/)
- [`tailwindlabs/headlessui` GitHub repository](https://github.com/tailwindlabs/headlessui)
- [npm registry: `@headlessui/react`](https://registry.npmjs.org/@headlessui/react)
- [React Aria: Accessibility / Quality](https://react-spectrum.adobe.com/react-aria/accessibility.html)
- [`adobe/react-spectrum` GitHub repository](https://github.com/adobe/react-spectrum)
- [`adobe/react-spectrum`: `react-aria-components` package](https://github.com/adobe/react-spectrum/tree/main/packages/react-aria-components)
- [npm registry: `react-aria-components`](https://registry.npmjs.org/react-aria-components)
- [`mui/base-ui` GitHub repository](https://github.com/mui/base-ui)
- [npm registry: `@base-ui-components/react`](https://registry.npmjs.org/@base-ui-components/react)
- Hyllan source: `src/app/delete-account-dialog.tsx`, `src/app/account-menu.tsx`, `src/app/items/item-form.tsx`, `src/app/signed-in-home.tsx`, `src/app/icons.tsx`, `package.json`
