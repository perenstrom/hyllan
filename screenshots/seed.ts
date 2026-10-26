// Per-scenario data seeding for the screenshot capture tool (PER-262).
// Reuses src/db/seed-support.ts (the same helpers `npm run db:seed` uses)
// rather than re-implementing account/household bootstrap — see that
// file's comment for why account creation goes through GoTrue's own
// /signup endpoint.
import { drizzle } from "drizzle-orm/postgres-js";
import type postgres from "postgres";

import * as schema from "@/db/schema";
import { barcodeProductNames } from "@/db/schema";
import {
  ensureItemsForHousehold,
  ensureLocations,
  findOrCreateAuthUser,
} from "@/db/seed-support";
import { registerBarcode } from "@/lib/barcode-registrations";
import { createHouseholdForUser } from "@/lib/household";
import type { AddPantryItemInput } from "@/lib/pantry-items";
import type { Scenario } from "./scenarios";

// Never used to actually log in (the capture tool authenticates by minting
// a session JWT directly — see src/lib/testing/mock-session.ts), but
// GoTrue's /signup endpoint requires some password.
const SCREENSHOT_ACCOUNT_PASSWORD = "screenshot-tool-password";

export type SeededContext = {
  userId: string;
  email: string;
  householdId: string;
  itemIds: string[];
  // Name -> id, for a scenario's `route` or `interactions` to reference a
  // seeded location the same way its `seed` function does.
  locationIds: Record<string, string>;
};

// Each scenario gets its own dedicated account (screenshot-<name>@example.com)
// instead of sharing one, so scenarios can't bleed pantry state into each
// other, and re-running the capture tool against an already-seeded database
// is a safe no-op — same idempotency guarantee ensureItemsForHousehold/
// ensureLocations already give db:seed.
//
// Locations named in `scenario.locations` are created first (so their ids
// exist to hand to `scenario.seed` when it's a function) — order matters,
// since a pantry item's locationId is a foreign key.
export async function seedScenario(
  sql: postgres.Sql,
  scenarioName: string,
  scenario: Pick<
    Scenario,
    "seed" | "locations" | "barcodeRegistrations" | "productNames"
  >,
): Promise<SeededContext> {
  const db = drizzle(sql, { schema });
  const email = `screenshot-${scenarioName}@example.com`;

  const userId = await findOrCreateAuthUser(
    sql,
    email,
    SCREENSHOT_ACCOUNT_PASSWORD,
  );
  const household = await createHouseholdForUser(db, userId);

  const locationIds = await ensureLocations(
    db,
    household.id,
    scenario.locations ?? [],
  );

  const items: AddPantryItemInput[] =
    typeof scenario.seed === "function"
      ? scenario.seed(locationIds)
      : (scenario.seed ?? []);
  const { items: seededItems } = await ensureItemsForHousehold(
    db,
    household.id,
    items,
  );

  // Reassigning on every run keeps a re-seeded scenario at its declared
  // registrations even if a previous capture's interactions moved one.
  for (const registration of scenario.barcodeRegistrations ?? []) {
    const item = seededItems.find(({ name }) => name === registration.itemName);
    if (!item) {
      throw new Error(`No seeded item named ${registration.itemName}`);
    }
    await registerBarcode(db, household.id, {
      barcodeValue: registration.value,
      symbology: "ean_13",
      pantryItemId: item.id,
      quantityPerScan: registration.quantityPerScan ?? "1",
      reassign: true,
    });
  }

  // The lookup cache is shared across households, so pre-filling it is
  // what keeps a scan scenario's name suggestion deterministic (and off
  // the live lookup APIs) rather than whatever Open Food Facts says today.
  for (const { value, name } of scenario.productNames ?? []) {
    const row = { productName: name, source: "open_food_facts" as const };
    await db
      .insert(barcodeProductNames)
      .values({ barcodeValue: value, ...row })
      .onConflictDoUpdate({
        target: barcodeProductNames.barcodeValue,
        set: row,
      });
  }

  return {
    userId,
    email,
    householdId: household.id,
    itemIds: seededItems.map((item) => item.id),
    locationIds,
  };
}
