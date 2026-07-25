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
    // Stored as a string (Drizzle's default numeric mode) rather than a JS
    // number to avoid floating-point precision loss on decimal quantities.
    quantity: numeric("quantity").notNull().default("0"),
    unit: pantryItemUnitEnum("unit").notNull().default("count"),
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
    check("pantry_items_quantity_non_negative", sql`${table.quantity} >= 0`),
  ],
);
