import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import * as schema from "@/db/schema";
import { barcodeProductNames } from "@/db/schema";
import type { ProductNameLookup } from "./product-name-lookup";
import { suggestProductName } from "./product-names";

const BARCODE = "7310865004703";
const DAY_MS = 24 * 60 * 60 * 1000;

async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  // The cache table has no FK into auth, but the earlier migrations do.
  await client.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
  `);
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  return { client, db };
}

function lookupAnswering(result: ProductNameLookup) {
  return vi.fn(async () => result);
}

describe("suggestProductName", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });

  beforeEach(async () => {
    await db.delete(barcodeProductNames);
  });

  afterAll(async () => {
    await client.close();
  });

  it("looks up an unseen barcode and caches the name it finds", async () => {
    const lookup = lookupAnswering({
      outcome: "found",
      name: "Fusilli",
      source: "open_food_facts",
    });

    expect(await suggestProductName(db, BARCODE, { lookup })).toEqual({
      name: "Fusilli",
      source: "open_food_facts",
    });
    expect(lookup).toHaveBeenCalledWith(BARCODE);

    const again = lookupAnswering({ outcome: "miss" });
    expect(await suggestProductName(db, BARCODE, { lookup: again })).toEqual({
      name: "Fusilli",
      source: "open_food_facts",
    });
    expect(again).not.toHaveBeenCalled();
  });

  it("remembers a miss, so a barcode no source knows isn't re-asked on every scan", async () => {
    await suggestProductName(db, BARCODE, {
      lookup: lookupAnswering({ outcome: "miss" }),
    });

    const again = lookupAnswering({
      outcome: "found",
      name: "Fusilli",
      source: "upcitemdb",
    });
    expect(await suggestProductName(db, BARCODE, { lookup: again })).toBeNull();
    expect(again).not.toHaveBeenCalled();
  });

  it("asks again once a remembered miss is old enough that a source may have learned the product", async () => {
    const then = new Date("2026-01-01T00:00:00Z");
    await suggestProductName(db, BARCODE, {
      lookup: lookupAnswering({ outcome: "miss" }),
      now: then,
    });

    const later = new Date(then.getTime() + 31 * DAY_MS);
    expect(
      await suggestProductName(db, BARCODE, {
        lookup: lookupAnswering({
          outcome: "found",
          name: "Fusilli",
          source: "upcitemdb",
        }),
        now: later,
      }),
    ).toEqual({ name: "Fusilli", source: "upcitemdb" });
  });

  it("caches nothing when the sources were unavailable, so the next scan tries again", async () => {
    expect(
      await suggestProductName(db, BARCODE, {
        lookup: lookupAnswering({ outcome: "unavailable" }),
      }),
    ).toBeNull();

    const again = lookupAnswering({
      outcome: "found",
      name: "Fusilli",
      source: "open_food_facts",
    });
    expect(
      await suggestProductName(db, BARCODE, { lookup: again }),
    ).not.toBeNull();
    expect(again).toHaveBeenCalled();
  });
});
