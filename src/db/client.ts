import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

declare global {
  var __hyllanDbClient: postgres.Sql | undefined;
}

function createClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  return postgres(databaseUrl);
}

// Reused across Next.js dev-server hot reloads so we don't leak a new
// Postgres connection pool on every file change.
const client = globalThis.__hyllanDbClient ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__hyllanDbClient = client;
}

export const db = drizzle(client, { schema });
