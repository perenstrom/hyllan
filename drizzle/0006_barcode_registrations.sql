CREATE TYPE "public"."barcode_symbology" AS ENUM('ean_13', 'upc_a', 'ean_8');--> statement-breakpoint
CREATE TYPE "public"."product_name_source" AS ENUM('open_food_facts', 'upcitemdb');--> statement-breakpoint
CREATE TABLE "barcode_product_names" (
	"barcode_value" text PRIMARY KEY NOT NULL,
	"product_name" text,
	"source" "product_name_source",
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barcode_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"pantry_item_id" uuid NOT NULL,
	"barcode_value" text NOT NULL,
	"symbology" "barcode_symbology" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "barcode_registrations" ADD CONSTRAINT "barcode_registrations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barcode_registrations" ADD CONSTRAINT "barcode_registrations_pantry_item_id_pantry_items_id_fk" FOREIGN KEY ("pantry_item_id") REFERENCES "public"."pantry_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "barcode_registrations_household_id_barcode_value_unique" ON "barcode_registrations" USING btree ("household_id","barcode_value");