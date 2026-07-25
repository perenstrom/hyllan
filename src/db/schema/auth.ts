import { pgSchema, uuid } from "drizzle-orm/pg-core";

// GoTrue owns and migrates this table itself (many more columns than shown
// here). Declared only so our tables can have a typed FK into it; never
// written to by app code. Deliberately kept out of drizzle.config.ts's
// `schema` glob so drizzle-kit never tries to create/alter it — see
// src/db/schema/app.ts, which is the file drizzle-kit actually scans.
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});
