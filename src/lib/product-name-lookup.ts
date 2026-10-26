import type { productNameSourceEnum } from "@/db/schema";

export type ProductNameSource =
  (typeof productNameSourceEnum.enumValues)[number];

// "miss" means every source answered and none knew the barcode — safe to
// cache. "unavailable" means at least one source failed (timeout, network,
// rate limit) and none found a name, so asking again later might succeed.
export type ProductNameLookup =
  | { outcome: "found"; name: string; source: ProductNameSource }
  | { outcome: "miss" }
  | { outcome: "unavailable" };

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

type Options = {
  fetchImpl?: FetchImpl;
  // Per source, so the whole chain is ~2× this in the worst case (ADR 0008).
  timeoutMs?: number;
};

// Open Food Facts asks every client to identify itself so it can reach
// the developer if the traffic misbehaves.
const USER_AGENT = "Hyllan/1.0 (+https://github.com/perenstrom/hyllan)";

type SourceAnswer = { name: string | null } | "failed";

type Source = {
  id: ProductNameSource;
  url: (barcodeValue: string) => string;
  // The product name from a 200 response, or null for a definite miss.
  readName: (body: unknown) => string | null;
};

function nonEmpty(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const SOURCES: Source[] = [
  {
    id: "open_food_facts",
    url: (barcodeValue) =>
      `https://world.openfoodfacts.org/api/v2/product/${barcodeValue}.json?fields=product_name`,
    // A miss is HTTP 200 with status 0; status 1 with an empty name is
    // nothing to suggest either, so it counts the same (ADR 0008).
    readName: (body) => {
      const { status, product } = body as {
        status?: number;
        product?: { product_name?: unknown };
      };
      return status === 1 ? nonEmpty(product?.product_name) : null;
    },
  },
  {
    id: "upcitemdb",
    // The keyless free tier: 100 lookups/day, 6/min.
    url: (barcodeValue) =>
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcodeValue}`,
    readName: (body) => {
      const { items } = body as { items?: { title?: unknown }[] };
      return nonEmpty(items?.[0]?.title);
    },
  },
];

async function ask(
  source: Source,
  barcodeValue: string,
  fetchImpl: FetchImpl,
  timeoutMs: number,
): Promise<SourceAnswer> {
  try {
    const response = await fetchImpl(source.url(barcodeValue), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) {
      return "failed";
    }
    return { name: source.readName(await response.json()) };
  } catch {
    return "failed";
  }
}

// The live lookup chain behind a first scan's name suggestion (ADR 0008):
// Open Food Facts, then UPCitemdb, each with its own timeout. Only the name
// is used — brands are dropped, since a pantry item has nowhere to put one.
export async function lookupProductName(
  barcodeValue: string,
  { fetchImpl = fetch, timeoutMs = 2000 }: Options = {},
): Promise<ProductNameLookup> {
  let anyFailed = false;
  for (const source of SOURCES) {
    const answer = await ask(source, barcodeValue, fetchImpl, timeoutMs);
    if (answer === "failed") {
      anyFailed = true;
    } else if (answer.name) {
      return { outcome: "found", name: answer.name, source: source.id };
    }
  }
  return anyFailed ? { outcome: "unavailable" } : { outcome: "miss" };
}
