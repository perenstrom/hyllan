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
  // Pantry items to seed into a dedicated household before capture. Omit
  // entirely for scenarios that must be captured signed out — no account
  // or household is created for those, matching the real signed-out state.
  seed?: AddPantryItemInput[];
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
];

const seenNames = new Set<string>();
for (const scenario of SCENARIOS) {
  if (seenNames.has(scenario.name)) {
    throw new Error(`Duplicate screenshot scenario name: "${scenario.name}"`);
  }
  seenNames.add(scenario.name);
}
