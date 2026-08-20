CREATE TABLE "item_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pantry_item_id" uuid NOT NULL,
	"location_id" uuid,
	"quantity" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_locations_quantity_non_negative" CHECK ("item_locations"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pantry_items" DROP CONSTRAINT "pantry_items_quantity_non_negative";--> statement-breakpoint
ALTER TABLE "item_locations" ADD CONSTRAINT "item_locations_pantry_item_id_pantry_items_id_fk" FOREIGN KEY ("pantry_item_id") REFERENCES "public"."pantry_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_locations" ADD CONSTRAINT "item_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "item_locations_item_location_unique" ON "item_locations" USING btree ("pantry_item_id","location_id") WHERE "item_locations"."location_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "item_locations_item_unassigned_unique" ON "item_locations" USING btree ("pantry_item_id") WHERE "item_locations"."location_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "locations_household_id_name_unique" ON "locations" USING btree ("household_id",lower("name"));--> statement-breakpoint
-- Backfill: every existing pantry item's quantity becomes its unassigned
-- bucket row (ADR 0005) before the column it came from is dropped below.
INSERT INTO "item_locations" ("pantry_item_id", "location_id", "quantity")
SELECT "id", NULL, "quantity" FROM "pantry_items";--> statement-breakpoint
ALTER TABLE "pantry_items" DROP COLUMN "quantity";