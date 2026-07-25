import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  out: "./drizzle",
  // Only the app-owned tables — deliberately excludes src/db/schema/auth.ts
  // (GoTrue's unmanaged auth.users) so drizzle-kit never generates DDL for it.
  schema: "./src/db/schema/app.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
