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
  // Barcode registrations (ADR 0007) to create once the items exist, by
  // seeded item name, and name-lookup cache entries (ADR 0008) to pre-fill
  // — scan scenarios use these so their outcome doesn't depend on live
  // lookup APIs.
  barcodeRegistrations?: {
    itemName: string;
    value: string;
    quantityPerScan?: string;
  }[];
  productNames?: { value: string; name: string }[];
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
  minimumQuantity: "1",
};

// Zero with no minimum set — Empty, not Out of stock (PER-325).
const EMPTY_ITEM: AddPantryItemInput = {
  name: "Saffron",
  quantity: "0",
  unit: "g",
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

// Valid EAN-13s for the scan scenarios — one registered, one not.
const REGISTERED_EAN = "7310865004703";
const UNREGISTERED_EAN = "4006381333931";

// Headless Chromium has no camera, so scan scenarios swap getUserMedia for
// a canvas stream that draws a real EAN-13 — the actual decoder then reads
// it, exactly as it would a pack held up to a phone. `null` makes the
// camera request fail instead, as a denied permission would.
async function fakeCamera(page: Page, ean: string | null) {
  await page.evaluate((code) => {
    const left = [
      "0001101",
      "0011001",
      "0010011",
      "0111101",
      "0100011",
      "0110001",
      "0101111",
      "0111011",
      "0110111",
      "0001011",
    ];
    const g = [
      "0100111",
      "0110011",
      "0011011",
      "0100001",
      "0011101",
      "0111001",
      "0000101",
      "0010001",
      "0001001",
      "0010111",
    ];
    const right = left.map((bits) =>
      bits.replace(/./g, (bit) => (bit === "0" ? "1" : "0")),
    );
    const parity = [
      "LLLLLL",
      "LLGLGG",
      "LLGGLG",
      "LLGGGL",
      "LGLLGG",
      "LGGLLG",
      "LGGGLL",
      "LGLGLG",
      "LGLGGL",
      "LGGLGL",
    ];

    if (code === null) {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("denied", "NotAllowedError"));
      return;
    }

    const digits = code.split("").map(Number);
    let bits = "101";
    for (let i = 1; i <= 6; i++) {
      bits += (parity[digits[0]][i - 1] === "L" ? left : g)[digits[i]];
    }
    bits += "01010";
    for (let i = 7; i <= 12; i++) {
      bits += right[digits[i]];
    }
    bits += "101";

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    const draw = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = "#000";
      const x0 = (640 - bits.length * 4) / 2;
      for (let i = 0; i < bits.length; i++) {
        if (bits[i] === "1") {
          ctx.fillRect(x0 + i * 4, 140, 4, 200);
        }
      }
    };
    draw();
    setInterval(draw, 100);
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(10);
    navigator.mediaDevices.enumerateDevices = async () => [];
  }, ean);
  await page.getByRole("button", { name: "Scan a barcode" }).click();
}

export const SCENARIOS: Scenario[] = [
  { name: "signed-out-home", route: "/" },
  { name: "login", route: "/login" },
  { name: "signup", route: "/signup" },
  { name: "forgot-password", route: "/forgot-password" },
  // No `seed` — no session cookie gets injected (see capture.spec.ts), the
  // same "not signed in" state a stale or already-used recovery link lands
  // on.
  { name: "reset-password-invalid", route: "/reset-password" },
  // `seed: []` is enough to get a mock session cookie injected even though
  // no household/items are needed — the reset-password form only checks
  // that a session exists (getClaims()), the same thing a real recovery
  // link's exchange would have produced, without this tool driving that
  // exchange for real.
  { name: "reset-password", seed: [], route: "/reset-password" },

  { name: "pantry-with-items", seed: DEFAULT_SEED_ITEMS, route: "/" },
  { name: "pantry-empty", seed: [], route: "/" },
  { name: "pantry-low-stock", seed: [LOW_STOCK_ITEM], route: "/" },
  { name: "pantry-out-of-stock", seed: [OUT_OF_STOCK_ITEM], route: "/" },
  { name: "pantry-empty-item", seed: [EMPTY_ITEM], route: "/" },

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

  // Stock take (PER-265): the "start a stock take" picker, then each of its
  // two independent flows, both reached from the manage-locations page.
  {
    name: "start-stock-take",
    locations: ["Pantry"],
    seed: (locationIds) => [
      {
        name: "Rice",
        quantity: "2",
        unit: "kg",
        locationId: locationIds.Pantry,
      },
    ],
    route: "/locations",
    interactions: async (page) => {
      await page.getByRole("button", { name: "Stock take" }).click();
      await page
        .getByRole("heading", { name: "Start a stock take" })
        .waitFor({ state: "visible" });
    },
  },
  {
    name: "stock-to-shelf-dialog",
    locations: ["Pantry"],
    seed: (locationIds) => [
      {
        name: "Rice",
        quantity: "2",
        unit: "kg",
        locationId: locationIds.Pantry,
      },
    ],
    route: "/locations",
    interactions: async (page) => {
      await page.getByRole("button", { name: "Stock take" }).click();
      await page
        .getByRole("button", { name: "Go through everything recorded here" })
        .click();
      await page
        .getByRole("heading", { name: "Stock take: Pantry" })
        .waitFor({ state: "visible" });
    },
  },
  {
    name: "shelf-to-stock-dialog",
    locations: ["Pantry"],
    seed: (locationIds) => [
      {
        name: "Rice",
        quantity: "2",
        unit: "kg",
        locationId: locationIds.Pantry,
      },
    ],
    route: "/locations",
    interactions: async (page) => {
      await page.getByRole("button", { name: "Stock take" }).click();
      await page.getByRole("button", { name: "Look up one item" }).click();
      await page.getByLabel("Item").click();
      await page.getByRole("button", { name: "Rice" }).click();
      await page.getByLabel("Quantity at Pantry").waitFor({ state: "visible" });
    },
  },

  // Batch entry (PER-307): the empty session, a session with a committed
  // entry and its reversal, add mode's inline-create offer, and remove
  // mode's no-match error.
  { name: "batch-add", seed: DEFAULT_SEED_ITEMS, route: "/batch/add" },
  {
    name: "batch-add-session",
    seed: [EDITABLE_ITEM, LOW_STOCK_ITEM],
    route: "/batch/add",
    interactions: async (page) => {
      await page.getByLabel("Item").fill("Coffee");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.getByRole("button", { name: "Reverse Coffee" }).waitFor();
      await page.getByLabel("Item").fill("Rice");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.getByRole("button", { name: "Reverse Rice" }).waitFor();
      await page.getByRole("button", { name: "Reverse Coffee" }).click();
      await page.getByText("(reversal)").waitFor({ state: "visible" });
    },
  },
  {
    name: "batch-add-create-offer",
    seed: [EDITABLE_ITEM],
    route: "/batch/add",
    interactions: async (page) => {
      await page.getByLabel("Item").fill("Lentils");
      await page
        .getByRole("button", { name: "Add “Lentils” as a new item" })
        .waitFor({ state: "visible" });
    },
  },
  {
    name: "batch-remove-no-match",
    seed: [EDITABLE_ITEM],
    route: "/batch/remove",
    interactions: async (page) => {
      await page.getByLabel("Item").fill("Lentils");
      await page.getByRole("button", { name: "Remove", exact: true }).click();
      await page
        .getByText("No item matches “Lentils”.")
        .waitFor({ state: "visible" });
    },
  },
  {
    name: "batch-scan-camera-denied",
    seed: [EDITABLE_ITEM],
    route: "/batch/add",
    interactions: async (page) => {
      await fakeCamera(page, null);
      await page
        .getByText("Camera access denied")
        .waitFor({ state: "visible" });
    },
  },
  {
    name: "batch-scan-register-barcode",
    seed: DEFAULT_SEED_ITEMS,
    productNames: [{ value: UNREGISTERED_EAN, name: "Fusilli" }],
    route: "/batch/add",
    interactions: async (page) => {
      await fakeCamera(page, UNREGISTERED_EAN);
      // Tapping the chip shows both the suggestion's effect and the
      // "Add as a new item" button that finishes the registration.
      await page
        .getByRole("button", { name: "Use suggested name Fusilli" })
        .click();
      await page
        .getByRole("button", { name: "Add “Fusilli” as a new item" })
        .waitFor({ state: "visible" });
    },
  },
  {
    name: "batch-scan-reassign-dialog",
    seed: DEFAULT_SEED_ITEMS,
    barcodeRegistrations: [{ itemName: "Pasta", value: REGISTERED_EAN }],
    route: "/batch/add",
    interactions: async (page) => {
      await fakeCamera(page, REGISTERED_EAN);
      await page.getByRole("button", { name: "Wrong item? (Pasta)" }).click();
      await page.getByLabel("Pantry item").fill("Rice");
      await page.getByRole("button", { name: "Rice", exact: true }).click();
      await page.getByRole("button", { name: "Add 1 kg" }).click();
      await page
        .getByRole("heading", { name: "Move this barcode to Rice?" })
        .waitFor({ state: "visible" });
    },
  },
  {
    // Step two of the pick-or-create panel: how much one scan is, with a
    // unit picker since this is a new item.
    name: "batch-scan-register-amount",
    seed: DEFAULT_SEED_ITEMS,
    productNames: [{ value: UNREGISTERED_EAN, name: "Fusilli" }],
    route: "/batch/add",
    interactions: async (page) => {
      await fakeCamera(page, UNREGISTERED_EAN);
      await page
        .getByRole("button", { name: "Use suggested name Fusilli" })
        .click();
      await page
        .getByRole("button", { name: "Add “Fusilli” as a new item" })
        .click();
      await page.getByLabel("Unit").selectOption("g");
      await page.getByLabel(/Each scan of this barcode/).fill("500");
      await page
        .getByRole("button", { name: "Add 500 g" })
        .waitFor({ state: "visible" });
    },
  },
  {
    name: "batch-remove-unregistered-scan",
    seed: [EDITABLE_ITEM],
    route: "/batch/remove",
    interactions: async (page) => {
      await fakeCamera(page, UNREGISTERED_EAN);
      await page
        .getByText("isn't registered to an item yet")
        .waitFor({ state: "visible" });
    },
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
