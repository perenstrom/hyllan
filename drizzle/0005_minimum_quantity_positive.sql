ALTER TABLE "pantry_items" DROP CONSTRAINT "pantry_items_minimum_quantity_non_negative";--> statement-breakpoint
UPDATE "pantry_items" SET "minimum_quantity" = NULL WHERE "minimum_quantity" = 0;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_minimum_quantity_positive" CHECK ("pantry_items"."minimum_quantity" > 0);
