# Research: Public barcode/product-name lookup APIs

**Ticket:** [PER-277 — Research public barcode/product-name lookup APIs](https://linear.app/per-enstrom/issue/PER-277/research-public-barcodeproduct-name-lookup-apis) (child of PER-274, "Batch stock entry with barcode scanning" Wayfinding map)

**Scope:** PER-274 is charting a barcode-scanning feature: when a household scans a barcode not yet registered to a pantry item, Hyllan may auto-suggest a product name/brand to speed up manual registration (manual entry stays the required fallback regardless — this ticket doesn't decide the UX, PER-279 does). This note surveys candidate public barcode → product-name lookup APIs/databases against primary sources (official API docs, terms-of-service pages), for a **small self-hosted deployment**: single-digit households, low request volume, household location unspecified (so international coverage matters, not just US).

For each candidate: coverage (incl. outside the US), rate limits/cost at this scale, terms of use (attribution, commercial-use restrictions), data quality/reliability, and the shape of a "no match" response.

---

## 1. Recommendation (summary)

**Use Open Food Facts (and its non-food sister databases) as the lookup source, called live at request time — no paid API needed.**

| Candidate | Verdict |
|---|---|
| **Open Food Facts** | **Recommended.** Free, no API key, no signup, generous-enough rate limits (15 req/min/IP for reads) for single-digit households, genuinely global/crowdsourced coverage, clear JSON "no match" shape. Attribution (ODbL) is a real but manageable obligation. |
| Open Products/Beauty/Pet Food Facts (OFF sister DBs) | **Worth wiring in alongside OFF** for the non-food pantry items (toiletries, cleaning supplies, pet food) OFF itself won't have. Same license/rate-limit shape as OFF. |
| UPCitemdb | **Viable fallback**, not primary. Free tier (100 req/day, no signup) easily covers this app's volume, but coverage skews US/UPC-A; terms are less clearly "open" (no ODbL-style redistribution right) and pricing jumps sharply past free. |
| Barcode Lookup (barcodelookup.com) | **Skip.** No real free tier (2-week trial only), plans start at $99/month — disproportionate for a self-hosted hobby-scale app. |
| Go-UPC | **Skip for now, note as backup.** Free tier is only 150 req/month (~5/day) — thinner than UPCitemdb's, and pricing/terms are less transparent without an account. |
| EAN-Search.org | **Skip.** No free tier at all (paid trial only, from €1/€9 per month up). |
| GS1 GEPIR / Verified by GS1 | **Skip as a lookup source.** This is a *company registry* (who owns a GS1 prefix), not a product-name database, and free access is capped at ~20–30 lookups/day even for that limited use. |

Detail and sourcing below.

---

## 2. Open Food Facts

**What it is:** a crowdsourced, open-data database of food products, run by a French non-profit association, with sister databases for beauty (Open Beauty Facts), pet food (Open Pet Food Facts), and everything else (Open Products Facts) — all built on the same "Product Opener" server and API shape. ([Open Food Facts API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/))

**Access:** no API key and no signup required for reads. Lookup by barcode is a plain `GET`:
```
GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
```
An optional `fields` parameter restricts the response to just the fields needed (e.g. `product_name,brands`), and `lc` selects a language for localized fields. Clients are asked to send a descriptive `User-Agent` header identifying the app, so the project can contact the developer if needed. ([OFF API tutorial](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/))

**Rate limits:** 15 requests/minute/IP for all read (product-fetch) queries, 10 requests/minute/IP for search queries, and **no stated limit on write** queries. Exceeding limits risks an IP ban. For requests originating from individual end-users (e.g. a mobile app scanning barcodes), OFF states the limit applies **per user**, not per app in aggregate. ([OFF API docs — rate limiting](https://openfoodfacts.github.io/openfoodfacts-server/api/)) For single-digit households doing occasional barcode scans, this is not a meaningfully binding constraint.

**Cost:** free, for any use including commercial, subject to the license terms below.

**Terms of use / license:** the database itself is under the **Open Database License (ODbL)**; individual database contents (i.e. field values) are under the **Database Contents License**; product images are under **Creative Commons Attribution-ShareAlike**. These are described as free licenses that authorize use and reproduction "for all purposes, including commercial use," under two conditions: **attribution**, and **share-alike** for any republished/derived *database* — if OFF data is combined with other data into a new database that is itself redistributed, that combined database must also be released as open data. ([OFF terms of use](https://world.openfoodfacts.org/terms-of-use)) Practically for Hyllan: querying the API live and displaying a suggested name/brand to a household (not republishing a scraped copy of the OFF database to third parties) is squarely inside normal use; a per-product credit/link (Open Food Facts explicitly asks contributors be creditable via a link back to the product) is the natural way to satisfy attribution in a product-detail or "suggested from Open Food Facts" UI element.

**Coverage:** roughly 3–4 million products as of 2025, contributed from 180+ countries, with 30+ countries having 10,000+ products and 8 countries above 100,000 products. Founded in France; strongest density in Europe, but explicitly global and growing, with localized front-ends per country (e.g. `se.openfoodfacts.org` for Sweden). Coverage is inherently uneven — dense where volunteer contributors are active, thin where they aren't — but is the only candidate here with real, verifiable *international* depth rather than a US-centric database. ([OFF press page](https://world.openfoodfacts.org/press), [OFF blog: 100K products from 177 countries](https://blog.openfoodfacts.org/en/news/know-what-you-eat-open-food-facts-opens-the-data-for-100k-food-products-from-177-countries))

**Data quality/reliability:** crowdsourced — an independent 2021 analysis found only ~67% of entries had complete macronutrient data, and OFF itself maintains an automated "data quality errors" checklist (218 distinct checks) plus community review/moderation to catch and fix bad entries. Product *names* and *brands* (what Hyllan actually needs, as opposed to full nutrition panels) are core, heavily-populated fields and generally reliable when a product exists in the database at all — the bigger risk for Hyllan's use case is a barcode simply not being present yet, not a wrong name once present. ([OFF wiki: data quality errors](https://wiki.openfoodfacts.org/List_of_data_quality_errors_(generated)))

**"No match" shape:** always HTTP 200 — OFF signals a miss in the response *body*, not via HTTP status, so callers must check the `status` field rather than the status code. Two miss shapes:
- Malformed/non-existent-looking barcode: `{"code":"00000000","status":0,"status_verbose":"no code or invalid code"}`
- Well-formed barcode not (yet) in the database: `{"code":"32562641919","status":0,"status_verbose":"product not found"}`

A hit looks like `{"code":"...","status":1,"status_verbose":"product found","product":{"product_name":"...","brands":"...", ...}}`. (Note: the sister Open Products/Pet Food Facts APIs return HTTP 404 on a miss instead — an inconsistency worth handling per-database if Hyllan queries more than one.) ([OFF API tutorial](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/))

**Non-food gap:** Open Food Facts is food-only. For non-food pantry items (cleaning supplies, toiletries, pet food) the sister databases exist on the same infrastructure and license/rate-limit terms: Open Beauty Facts, Open Pet Food Facts, and Open Products Facts (explicitly "the database of everything" catch-all, launched 2018). Worth querying as a fallback chain (OFF → OBF/OPFF/Open Products Facts) for full pantry coverage, though these sister DBs are smaller and younger than OFF itself. ([Open Products Facts](https://world.openproductsfacts.org/), OFF GitHub org)

---

## 3. UPCitemdb

**What it is:** a commercial UPC/EAN/ISBN lookup database and API (JingBang Int'l, Inc.), with a genuinely free, no-signup tier alongside paid tiers. ([UPCitemdb API](https://www.upcitemdb.com/api/))

**Access/rate limits (free "Explorer" tier):** no signup required — usable immediately, rate-limited per IP. Free tier allows **100 combined requests/day** (`LookupRequest` + `SearchRequest`), with `SearchRequest` capped at 40/day within that, and a burst limit of **6 requests/minute**; requests beyond that get HTTP 429. The free tier hits a different URL path (`/trial` vs. `/prod/v1` for paid) but returns the **same full database** as paid plans. ([UPCitemdb: API rate limits](https://www.upcitemdb.com/wp/docs/main/development/api-rate-limits/), [UPCitemdb: Getting started](https://www.upcitemdb.com/wp/docs/main/development/getting-started/)) 100/day comfortably covers single-digit households doing occasional scans.

**Paid tiers:** paid plans (DEV and above) move to per-application rate limiting, e.g. the DEV plan allows up to 2,000 search + 20,000 lookup requests/day, billed monthly with overage charged per the plan's rate; reported starting price around $29–$149/month depending on tier (exact figures require the live pricing page, which was not fully enumerable via search). Not needed at this app's scale — the free tier suffices.

**Terms of use:** UPCitemdb's terms grant a "limited, non-exclusive, non-transferable and terminable license to access and use the Service" for the customer's own operations; IP in each party's "pre-existing materials" stays with that party. This is a conventional commercial API license, **not** an open-data license like OFF's ODbL — there's no explicit redistribution/share-alike right, and no clearly stated attribution requirement one way or the other in what's publicly discoverable. Treat it as "internal use only, no redistribution of the raw dataset" pending a closer read of the full ToS if adopted. ([UPCitemdb Terms & Conditions](https://upcitemdb.com/terms))

**Coverage:** UPCitemdb advertises itself as the largest UPC lookup database (700M+ unique UPC/EAN numbers), supporting UPC-A, UPC-E, EAN-8, EAN-13, GTIN-14, ISBN-10/13. UPC-A is fundamentally a US/Canada retail standard; EAN-13 (the format used in Europe/most of the rest of the world) is also supported, but the product's own framing and general reputation is **US-centric** — real international (especially non-English-market) coverage is less proven than OFF's. ([UPCitemdb homepage](https://www.upcitemdb.com/))

**"No match" shape:** JSON response `{ "code": string, "total": number, "offset": number, "items": [...] }`; a miss is a normal 200 response with `"total": 0` and `"items": []` rather than an error — UPCitemdb's own docs describe this as "genuine answer, not a failed request." ([UPCitemdb: Responses](https://www.upcitemdb.com/wp/docs/main/development/responses/))

**Verdict:** a reasonable **fallback** behind Open Food Facts (query OFF first; if no match, try UPCitemdb's free tier) — free tier is generous enough at this scale and needs no signup, but its narrower openness/attribution story and US skew make it a worse primary choice than OFF.

---

## 4. Barcode Lookup (barcodelookup.com)

**What it is:** a commercial UPC/EAN/ISBN product database and API. ([Barcode Lookup API](https://www.barcodelookup.com/api))

**Access/cost:** a free *account* is available for two weeks only; after that, only paid plans remain, starting at **$99/month**. Rate limit is up to 100 requests/minute (higher for Enterprise), and the monthly quota is only decremented on successful (HTTP 200, data-returned) requests. ([Barcode Lookup API docs](https://www.barcodelookup.com/api-documentation))

**Terms:** the discoverable terms address user-submitted data (Barcode Lookup takes a broad license to data users submit to it) more than they clearly spell out redistribution rights for API consumers of its own product data; not evaluated further given the pricing disqualifies it below.

**Verdict:** **Skip.** $99/month minimum is disproportionate for a self-hosted app serving a handful of households at low volume — there is no tier that fits this deployment's scale economics.

---

## 5. Go-UPC

**What it is:** another commercial barcode/product database and API, marketed as covering 500M+ products. ([Go-UPC](https://go-upc.com/))

**Access/rate limits:** free plan capped at **150 requests/month** (roughly 5/day averaged), with a hard rate limit of 2 requests/second regardless of tier; higher rate limits available on request/paid plans. ([Go-UPC: Free plan application](https://go-upc.com/plans/api/trial), [Go-UPC: API docs](https://go-upc.com/docs))

**Verdict:** technically usable at this app's volume (single-digit households likely scan well under 150/month), but a thinner, less-battle-tested free tier than UPCitemdb's, with less publicly documented terms/coverage detail. Worth knowing about as a second fallback, not worth adopting over UPCitemdb.

---

## 6. EAN-Search.org

**What it is:** a paid EAN/GTIN/UPC/ISBN lookup API with no ongoing free tier — only a low-cost first-month trial (100 queries for €1), then €9/month for a small quota, scaling up (e.g. a "Pro" tier at €19/month for 5,000 queries). ([EAN-Search.org](https://www.ean-search.org/))

**Verdict:** **Skip.** No genuinely free tier removes the main appeal for a hobby-scale self-hosted app; OFF and UPCitemdb's free tiers already cover this app's volume at zero ongoing cost.

---

## 7. GS1 GEPIR / Verified by GS1

**What it is:** GS1's own registry service. As of January 2024, the legacy **GEPIR** (Global Electronic Party Information Register) service was replaced by **Verified by GS1**. Both are fundamentally a **company/licensee lookup** — given a GTIN (the number encoded in a barcode), they identify which GS1-member company owns that number, plus (for Verified by GS1) some "basic core UPC product data when provided" by the brand owner — not a general product-name database in the way OFF or UPCitemdb are. ([GEPIR overview — Open Product Data / OKFN](https://product.okfn.org/gs1-data-resources/index.html), [Verified by GS1](https://www.gepir.org/))

**Access:** free in almost all countries, but capped at roughly **20–30 searches/day** — thinner than any other candidate here, for data that's less directly useful (company identity, not product name/brand) unless the brand owner has also populated "Verified by GS1" with product data. Enterprise/batch API access exists but isn't self-serve or free. ([GS1 Australia: GEPIR](https://www.gs1au.org/services/search-gepir))

**Verdict:** **Skip as a lookup source for this feature.** Even where it returns product data, coverage depends entirely on individual brand owners opting in to populate it, and the free-tier rate limit is the tightest of any candidate surveyed. Not a substitute for OFF/UPCitemdb.

---

## 8. Practical shape for Hyllan

Given the above, a workable and cheap architecture for PER-274's auto-suggest step:

1. On an unrecognized barcode scan, call Open Food Facts's `GET /api/v2/product/{barcode}.json?fields=product_name,brands` with a descriptive `User-Agent` (e.g. `Hyllan/1.0 (+https://github.com/perenstrom/hyllan)` per OFF's own convention).
2. If `status: 0` and the barcode looks like a non-food item (or OFF simply has no match), optionally fall back to Open Products Facts / Open Beauty Facts / Open Pet Food Facts (same call shape, same license, watch for their 404-based miss behavior instead of `status:0`).
3. If still no match, UPCitemdb's free tier (`GET https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}`, 100/day, no key) is a reasonable secondary fallback given the low request volume this app will ever generate.
4. Whatever suggestion surfaces gets attributed (a small "via Open Food Facts" credit/link satisfies ODbL attribution) and is always just a **prefill** — manual entry remains the required fallback per PER-274's framing, so a total miss across all sources is simply "no suggestion, user types the name" with no special-case UI needed.

This is a design starting point for whoever picks up the follow-on implementation ticket, not a decision this research ticket is meant to lock in — PER-279 (blocked by this ticket) is where the actual autofill *behavior* gets decided.

---

## Sources

- [Open Food Facts API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- [Open Food Facts API tutorial](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/)
- [Open Food Facts terms of use](https://world.openfoodfacts.org/terms-of-use)
- [Open Food Facts press page](https://world.openfoodfacts.org/press)
- [Open Food Facts blog: 100K products from 177 countries](https://blog.openfoodfacts.org/en/news/know-what-you-eat-open-food-facts-opens-the-data-for-100k-food-products-from-177-countries)
- [Open Food Facts wiki: list of data quality errors](https://wiki.openfoodfacts.org/List_of_data_quality_errors_(generated))
- [Open Products Facts](https://world.openproductsfacts.org/)
- [UPCitemdb API](https://www.upcitemdb.com/api/)
- [UPCitemdb: API rate limits](https://www.upcitemdb.com/wp/docs/main/development/api-rate-limits/)
- [UPCitemdb: Getting started](https://www.upcitemdb.com/wp/docs/main/development/getting-started/)
- [UPCitemdb: Responses](https://www.upcitemdb.com/wp/docs/main/development/responses/)
- [UPCitemdb Terms & Conditions](https://upcitemdb.com/terms)
- [Barcode Lookup API](https://www.barcodelookup.com/api)
- [Barcode Lookup API documentation](https://www.barcodelookup.com/api-documentation)
- [Go-UPC](https://go-upc.com/)
- [Go-UPC: free plan application](https://go-upc.com/plans/api/trial)
- [EAN-Search.org](https://www.ean-search.org/)
- [GEPIR overview (Open Product Data / OKFN)](https://product.okfn.org/gs1-data-resources/index.html)
- [Verified by GS1](https://www.gepir.org/)
- [GS1 Australia: GEPIR](https://www.gs1au.org/services/search-gepir)
