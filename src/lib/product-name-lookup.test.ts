import { describe, expect, it, vi } from "vitest";

import { lookupProductName } from "./product-name-lookup";

const BARCODE = "7310865004703";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const OFF_HIT = {
  code: BARCODE,
  status: 1,
  product: { product_name: "Fusilli", brands: "Barilla" },
};
const OFF_MISS = {
  code: BARCODE,
  status: 0,
  status_verbose: "product not found",
};
const UPC_HIT = { code: "OK", total: 1, items: [{ title: "Fusilli Pasta" }] };
const UPC_MISS = { code: "OK", total: 0, items: [] };

// Routes each request to a responder by host, so a test states what each
// source answers and the chain's order is what's under test.
function fakeFetch(responders: {
  off?: () => Promise<Response>;
  upc?: () => Promise<Response>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return vi.fn(async (input: string, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("openfoodfacts.org")) {
      return responders.off ? responders.off() : json(OFF_MISS);
    }
    if (url.includes("upcitemdb.com")) {
      return responders.upc ? responders.upc() : json(UPC_MISS);
    }
    throw new Error(`unexpected request to ${url}`);
  });
}

// Never settles on its own — only the lookup's timeout abort ends it.
function hang(signal?: AbortSignal | null) {
  return new Promise<Response>((_, reject) => {
    signal?.addEventListener("abort", () => reject(signal.reason));
  });
}

describe("lookupProductName", () => {
  it("takes Open Food Facts' product name, dropping the brand (ADR 0008)", async () => {
    const fetchImpl = fakeFetch({ off: async () => json(OFF_HIT) });

    expect(await lookupProductName(BARCODE, { fetchImpl })).toEqual({
      outcome: "found",
      name: "Fusilli",
      source: "open_food_facts",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("asks Open Food Facts for just the name, identifying the app", async () => {
    const fetchImpl = fakeFetch({ off: async () => json(OFF_HIT) });

    await lookupProductName(BARCODE, { fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      `https://world.openfoodfacts.org/api/v2/product/${BARCODE}.json?fields=product_name`,
    );
    expect(new Headers(init?.headers).get("user-agent")).toMatch(/^Hyllan\//);
  });

  it("falls back to UPCitemdb when Open Food Facts doesn't know the barcode", async () => {
    const fetchImpl = fakeFetch({ upc: async () => json(UPC_HIT) });

    expect(await lookupProductName(BARCODE, { fetchImpl })).toEqual({
      outcome: "found",
      name: "Fusilli Pasta",
      source: "upcitemdb",
    });
    expect(String(fetchImpl.mock.calls[1][0])).toBe(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${BARCODE}`,
    );
  });

  it("treats an Open Food Facts hit with an empty name as a miss", async () => {
    const fetchImpl = fakeFetch({
      off: async () =>
        json({ ...OFF_HIT, product: { product_name: "  ", brands: "X" } }),
      upc: async () => json(UPC_HIT),
    });

    expect(await lookupProductName(BARCODE, { fetchImpl })).toMatchObject({
      outcome: "found",
      source: "upcitemdb",
    });
  });

  it("reports a miss when neither source knows the barcode", async () => {
    const fetchImpl = fakeFetch({});

    expect(await lookupProductName(BARCODE, { fetchImpl })).toEqual({
      outcome: "miss",
    });
  });

  it("moves on to UPCitemdb when Open Food Facts doesn't answer in time", async () => {
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) =>
      String(input).includes("openfoodfacts.org")
        ? hang(init?.signal)
        : json(UPC_HIT),
    );

    expect(
      await lookupProductName(BARCODE, { fetchImpl, timeoutMs: 10 }),
    ).toMatchObject({ outcome: "found", source: "upcitemdb" });
  });

  it("reports unavailable, not a miss, when a source failed and none found a name", async () => {
    const fetchImpl = fakeFetch({
      off: async () => {
        throw new TypeError("fetch failed");
      },
    });

    expect(await lookupProductName(BARCODE, { fetchImpl })).toEqual({
      outcome: "unavailable",
    });
  });

  it("counts a non-200 answer (e.g. UPCitemdb's 429 rate limit) as a failure", async () => {
    const fetchImpl = fakeFetch({
      upc: async () => json({ code: "TOO_FAST" }, 429),
    });

    expect(await lookupProductName(BARCODE, { fetchImpl })).toEqual({
      outcome: "unavailable",
    });
  });
});
