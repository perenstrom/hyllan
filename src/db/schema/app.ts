import { sql } from "drizzle-orm";
import {
  check,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth";

export const households = pgTable(
  "households",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Cascades so that deleting the GoTrue user row immediately removes the
    // household (and, transitively, its pantry items) — ADR 0002.
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // A household is strictly single-user (ADR 0002) — this is what lets
    // signup's household-auto-creation be a safe no-op on retry rather than
    // risking a duplicate household per user.
    uniqueIndex("households_user_id_unique").on(table.userId),
  ],
);

export const pantryItemUnitEnum = pgEnum("pantry_item_unit", [
  "count",
  "g",
  "kg",
  "ml",
  "l",
  "box",
  "bag",
  "pack",
]);

export const pantryItems = pgTable(
  "pantry_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: pantryItemUnitEnum("unit").notNull().default("count"),
    // The least the household wants on hand (CONTEXT.md "Minimum
    // quantity") — unset (null) means the item isn't restocked. In the
    // item's own `unit`, same numeric shape as a location's quantity (see
    // itemLocations below).
    minimumQuantity: numeric("minimum_quantity"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("pantry_items_household_id_name_unique").on(
      table.householdId,
      sql`lower(${table.name})`,
    ),
    // NULL passes a CHECK constraint unmodified, so this only constrains
    // the column once a household actually sets a minimum. Zero is
    // rejected (PER-325) — "unset" is how you say you don't restock it.
    check(
      "pantry_items_minimum_quantity_positive",
      sql`${table.minimumQuantity} > 0`,
    ),
  ],
);

// A place within a household's pantry (CONTEXT.md "Location") that a pantry
// item's quantity can be broken out across — household-managed, same
// case-insensitive per-household name uniqueness as pantry items (ADR 0005).
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("locations_household_id_name_unique").on(
      table.householdId,
      sql`lower(${table.name})`,
    ),
  ],
);

// A pantry item's quantity at one Location, or (locationId null) at the
// implicit unassigned bucket — not a real Location row (ADR 0005). Identity
// stays exactly ADR 0001's; only where quantity is tracked moves here, as
// the sum of these rows per item (CONTEXT.md "Quantity").
//
// locationId carries no onDelete action: deleting a Location must merge its
// rows into the item's unassigned row first (src/lib/locations.ts), which a
// DB-level SET NULL/CASCADE can't do safely against the partial unique
// indexes below (a plain SET NULL could collide with an existing unassigned
// row for the same item).
export const itemLocations = pgTable(
  "item_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pantryItemId: uuid("pantry_item_id")
      .notNull()
      .references(() => pantryItems.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => locations.id),
    // Same string-not-number rationale as pantry_items.quantity used to
    // carry (see git history) — avoids float precision loss on decimals.
    quantity: numeric("quantity").notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // At most one row per (item, location) pairing (ADR 0005) — split into
    // two partial indexes because Postgres treats every NULL as distinct in
    // a plain unique index, which would let an item collect multiple
    // unassigned rows instead of the one the "implicit bucket" model
    // requires.
    uniqueIndex("item_locations_item_location_unique")
      .on(table.pantryItemId, table.locationId)
      .where(sql`${table.locationId} is not null`),
    uniqueIndex("item_locations_item_unassigned_unique")
      .on(table.pantryItemId)
      .where(sql`${table.locationId} is null`),
    check("item_locations_quantity_non_negative", sql`${table.quantity} >= 0`),
  ],
);

export const barcodeSymbologyEnum = pgEnum("barcode_symbology", [
  "ean_13",
  "upc_a",
  "ean_8",
]);

// Links a scanned barcode to one of the household's pantry items (ADR
// 0007). barcodeValue is the canonical form (src/lib/barcode.ts) — UPC-A
// already padded into EAN-13 — so it alone is the identity; symbology is
// informational only. Cascades with the pantry item: a registration
// pointing at nothing serves no purpose.
export const barcodeRegistrations = pgTable(
  "barcode_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    pantryItemId: uuid("pantry_item_id")
      .notNull()
      .references(() => pantryItems.id, { onDelete: "cascade" }),
    barcodeValue: text("barcode_value").notNull(),
    symbology: barcodeSymbologyEnum("symbology").notNull(),
    // How much one scan of this barcode adds or removes, in the item's own
    // unit — a pack's barcode stands for a fixed amount (a 500 g bag is
    // 500, a six-pack counted in cans is 6). Same numeric-as-string shape
    // as item_locations.quantity.
    quantityPerScan: numeric("quantity_per_scan").notNull().default("1"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("barcode_registrations_household_id_barcode_value_unique").on(
      table.householdId,
      table.barcodeValue,
    ),
    check(
      "barcode_registrations_quantity_per_scan_positive",
      sql`${table.quantityPerScan} > 0`,
    ),
  ],
);

export const productNameSourceEnum = pgEnum("product_name_source", [
  "open_food_facts",
  "upcitemdb",
]);

// Product-name lookups on first scan (ADR 0008), cached by canonical
// barcode value and shared across households — a product's name belongs
// to the product, not to whoever scanned it. A null productName records a
// miss, so a barcode no source knows isn't re-asked on every scan.
export const barcodeProductNames = pgTable("barcode_product_names", {
  barcodeValue: text("barcode_value").primaryKey(),
  productName: text("product_name"),
  source: productNameSourceEnum("source"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
