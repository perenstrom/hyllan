// The screenshot scenario catalog (PER-262): every route the app has, plus
// every modal/dialog-triggered state, each capturable at both a desktop and
// a mobile viewport (see capture.spec.ts). Adding a new page or a new
// visually distinct state (a modal, an empty/error state) to the app means
// adding an entry here.
import type { Page } from "@playwright/test";

import { DEFAULT_SEED_ITEMS } from "@/db/seed-support";
import type { AddPantryItemInput } from "@/lib/pantry-items";
import type { SeededContext } from "./seed";

export type Scenario = {
  name: string;
  // Household-scoped locations (PER-288) to create before `seed` runs, so
  // a function-form `seed` can assign items to them by id. Omit for
  // scenarios that don't need any (most of them).
  locations?: string[];
  // Pantry items to seed into a dedicated household before capture. Omit
  // entirely for scenarios that must be captured signed out — no account
  // or household is created for those, matching the real signed-out state.
  // The function form receives the name -> id map `locations` above
  // produced, for a scenario that needs to assign an item to a specific
  // seeded location.
  seed?:
    | AddPantryItemInput[]
    | ((locationIds: Record<string, string>) => AddPantryItemInput[]);
  // A static route, or one computed from the seeded data (e.g. an item's
  // id for the edit-item route).
  route: string | ((ctx: SeededContext) => string);
  // Extra steps to reach a state that isn't a route by itself, e.g.
  // opening a dialog.
  interactions?: (page: Page) => Promise<void>;
};

const LOW_STOCK_ITEM: AddPantryItemInput = {
  name: "Coffee",
  quantity: "500",
  unit: "g",
  minimumQuantity: "600",
};

const OUT_OF_STOCK_ITEM: AddPantryItemInput = {
  name: "Rice",
  quantity: "0",
  unit: "kg",
  minimumQuantity: null,
};

const EDITABLE_ITEM: AddPantryItemInput = {
  name: "Rice",
  quantity: "2",
  unit: "kg",
  minimumQuantity: "1",
};

const DELETABLE_ITEM: AddPantryItemInput = {
  name: "Rice",
  quantity: "2",
  unit: "kg",
  minimumQuantity: null,
};

export const SCENARIOS: Scenario[] = [
  { name: "signed-out-home", route: "/" },
  { name: "login", route: "/login" },
  { name: "signup", route: "/signup" },

  { name: "pantry-with-items", seed: DEFAULT_SEED_ITEMS, route: "/" },
  { name: "pantry-empty", seed: [], route: "/" },
  { name: "pantry-low-stock", seed: [LOW_STOCK_ITEM], route: "/" },
  { name: "pantry-out-of-stock", seed: [OUT_OF_STOCK_ITEM], route: "/" },

  { name: "add-item", seed: [], route: "/items/new" },
  {
    name: "edit-item",
    seed: [EDITABLE_ITEM],
    route: (ctx) => `/items/${ctx.itemIds[0]}/edit`,
  },

  // Locations (PER-288): Rice split across a "Pantry" location and the
  // implicit unassigned bucket — the same item, added twice at different
  // locations, merges into one multi-location row (ADR 0005) rather than
  // two separate items.
  {
    name: "pantry-multi-location",
    locations: ["Pantry"],
    seed: (locationIds) => [
      {
        name: "Rice",
        quantity: "2",
        unit: "kg",
        locationId: locationIds.Pantry,
      },
      { name: "Rice", quantity: "1.5", unit: "kg", locationId: null },
    ],
    route: "/",
  },
  {
    name: "pantry-by-location",
    locations: ["Pantry"],
    seed: (locationIds) => [
      {
        name: "Rice",
        quantity: "2",
        unit: "kg",
        locationId: locationIds.Pantry,
      },
      { name: "Rice", quantity: "1.5", unit: "kg", locationId: null },
    ],
    route: "/",
    interactions: async (page) => {
      await page.getByRole("button", { name: "By location" }).click();
    },
  },
  {
    name: "locations-filter-dropdown",
    locations: ["Pantry"],
    seed: (locationIds) => [
      {
        name: "Rice",
        quantity: "2",
        unit: "kg",
        locationId: locationIds.Pantry,
      },
    ],
    route: "/",
    interactions: async (page) => {
      await page.getByRole("button", { name: /^Locations/ }).click();
    },
  },
  {
    name: "add-item-location-picker",
    locations: ["Pantry"],
    seed: [],
    route: "/items/new",
    interactions: async (page) => {
      const field = page.getByLabel("Location (optional)");
      await field.click();
      // Focusing selects the default "Unassigned" text (so typing
      // replaces it) rather than clearing it — clear it explicitly so the
      // dropdown shows every option, not just ones matching "unassigned".
      await field.fill("");
    },
  },
  {
    name: "manage-locations",
    locations: ["Pantry", "Garage fridge"],
    seed: [],
    route: "/locations",
  },
  { name: "manage-locations-empty", seed: [], route: "/locations" },

  { name: "account", seed: [], route: "/account" },

  {
    name: "delete-account-dialog",
    seed: [],
    route: "/",
    interactions: async (page) => {
      await page.getByRole("button", { name: "Account menu" }).click();
      await page.getByRole("menuitem", { name: "Delete account" }).click();
      await page
        .getByRole("heading", { name: "Delete account?" })
        .waitFor({ state: "visible" });
    },
  },

  {
    name: "delete-item-dialog",
    seed: [DELETABLE_ITEM],
    route: "/",
    interactions: async (page) => {
      await page.getByRole("button", { name: "Actions for Rice" }).click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await page
        .getByRole("heading", { name: "Delete Rice?" })
        .waitFor({ state: "visible" });
    },
  },
];

const seenNames = new Set<string>();
for (const scenario of SCENARIOS) {
  if (seenNames.has(scenario.name)) {
    throw new Error(`Duplicate screenshot scenario name: "${scenario.name}"`);
  }
  seenNames.add(scenario.name);
}
