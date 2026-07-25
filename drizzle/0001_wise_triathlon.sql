ALTER TABLE "households" DROP CONSTRAINT "households_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;