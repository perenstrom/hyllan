import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { barcodeProductNames } from "@/db/schema";
import {
  lookupProductName,
  type ProductNameLookup,
  type ProductNameSource,
} from "./product-name-lookup";

type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> =
  PgDatabase<TQueryResult, typeof schema>;

export type ProductNameSuggestion = {
  name: string;
  source: ProductNameSource;
};

// A found name is a property of the product and kept indefinitely; a miss
// is only remembered this long, since Open Food Facts is crowdsourced and
// may learn the product later.
const MISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Options = {
  lookup?: (barcodeValue: string) => Promise<ProductNameLookup>;
  now?: Date;
};

// The name suggestion for an unregistered scan (ADR 0008), served from the
// shared barcode-keyed cache when it can be — that cache is the main
// lever against Open Food Facts' per-IP rate limit, since every household
// shares this server's IP. barcodeValue must already be canonical.
export async function suggestProductName<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  barcodeValue: string,
  { lookup = lookupProductName, now = new Date() }: Options = {},
): Promise<ProductNameSuggestion | null> {
  const [cached] = await db
    .select()
    .from(barcodeProductNames)
    .where(eq(barcodeProductNames.barcodeValue, barcodeValue));
  if (cached?.productName && cached.source) {
    return { name: cached.productName, source: cached.source };
  }
  if (cached && now.getTime() - cached.fetchedAt.getTime() < MISS_TTL_MS) {
    return null;
  }

  const result = await lookup(barcodeValue);
  if (result.outcome === "unavailable") {
    return null;
  }

  const row =
    result.outcome === "found"
      ? { productName: result.name, source: result.source }
      : { productName: null, source: null };
  await db
    .insert(barcodeProductNames)
    .values({ barcodeValue, ...row, fetchedAt: now })
    .onConflictDoUpdate({
      target: barcodeProductNames.barcodeValue,
      set: { ...row, fetchedAt: now },
    });

  return result.outcome === "found"
    ? { name: result.name, source: result.source }
    : null;
}
