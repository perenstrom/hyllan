# Research: Barcode decoding tech for browser-based scanning

**Ticket:** [PER-276 — Research barcode decoding tech for browser-based scanning](https://linear.app/per-enstrom/issue/PER-276/research-barcode-decoding-tech-for-browser-based-scanning) (child of PER-274, "Batch stock entry with barcode scanning" Wayfinding map)

**Scope:** PER-274 charts a barcode-scanning feature that must work entirely in the browser (camera via `getUserMedia`) — going native was explicitly ruled out. This note answers: does the native `BarcodeDetector` API cover the target platforms (notably Safari/iOS, the likely primary grocery-scanning device)? If not, which JS fallback library should Hyllan use, given it needs 1D symbologies (EAN-13/UPC-A/EAN-8), not just QR codes? And what practical camera/lighting/focus constraints apply to phone-browser scanning?

---

## 1. Recommendation (summary)

**Do not build against the native `BarcodeDetector` API directly. Use the [`barcode-detector`](https://github.com/Sec-ant/barcode-detector) npm package as a drop-in ponyfill/polyfill instead.**

| Question | Answer |
|---|---|
| Is native `BarcodeDetector` usable today for Hyllan's primary use case (iPhone Safari)? | **No.** It ships in Chromium (desktop macOS + Android, since Chrome 83/88) but has never shipped un-flagged in Safari on any OS. WebKit's own tracking issue is labeled `position: support`, and code has started landing, but as of this research it is still behind an off-by-default experimental flag in Safari 17/18, and Apple's own developer forums + a WebKit bug report document it as actively **broken** in iOS 18 for the few users who did enable the flag (§2). |
| What should Hyllan use instead? | **[`barcode-detector`](https://www.npmjs.com/package/barcode-detector)** (GitHub: `Sec-ant/barcode-detector`) — a small (~255 KB unpacked, MIT-licensed) TypeScript package that implements the *same* `BarcodeDetector` constructor/`detect()`/`getSupportedFormats()` shape as the native API, backed by `zxing-wasm` (a WebAssembly build of the actively-maintained `zxing-cpp`, Apache-2.0). Import it as a **polyfill** and the app gets the fast native implementation where Chrome/Chromium-Android already has it, and a consistent WASM fallback everywhere else (Safari/iOS included), with **zero dual-code-path branching** in application code (§3, §4). |
| Why not `@zxing/library`/`@zxing/browser` (ZXing-js) directly? | Works, is the most-downloaded pure-JS option, and correctly decodes EAN-13/UPC-A/EAN-8 — but the maintainers state the project is in **maintenance mode** and are explicitly recruiting a new owner; changes are patch-driven only (§4). It's a reasonable fallback if the polyfill approach is rejected, but the `barcode-detector`/`zxing-wasm` line (by the same ecosystem, actively released as recently as **yesterday** relative to this research) is the better-maintained, faster (WASM ≈2× pure-JS) choice built on the same decoding engine philosophy. |
| Why not QuaggaJS/Quagga2? | Actively maintained (commits as recent as June 2026) and good at 1D formats specifically — but it **has no QR/2D support at all**, and Hyllan doesn't need QR here, so this isn't disqualifying on its own; it's a legitimate lighter-weight alternative if the app only ever needs 1D retail codes (§4). |
| Why not html5-qrcode? | Explicitly "in maintenance mode until further notice" with PRs not being merged; last substantive commit well over a year old as of this research despite one README touch-up in Dec 2025 (§4). |
| Why not Dynamsoft (or Scanbot/STRICH)? | Commercial SDKs with real accuracy advantages in hostile conditions (worn/damaged/angled codes), but licensed per-year (Dynamsoft: **from ~$1,470/yr**, renewal ~$1,371/yr) — disproportionate for a self-hosted household pantry app (§4). |
| Which symbologies matter? | **EAN-13** (the standard scanned at grocery checkouts worldwide, incl. Sweden) and **UPC-A** (US/Canada retail default) are the two that matter for virtually all real grocery packaging. **EAN-8** is worth supporting too — it's the real, GS1-issued short format reserved for products too small to fit a full EAN-13/UPC-A (candy, small cosmetics, spice jars) and pantry goods do include such items. ITF-14 exists but is a *case/carton* code, not scanned at a per-item pantry level, so it's not worth prioritizing (§5). |
| Camera/lighting/focus gotchas? | `facingMode: 'environment'` (rear camera) is broadly supported everywhere, including Safari. But **torch (flashlight) and `focusMode`/`focusDistance` constraints are Chrome/Android-only** — iOS Safari does not expose either through `getUserMedia`/`MediaTrackConstraints`, so on iPhone the app cannot programmatically force a torch-on-in-dim-pantry or tap-to-focus behavior; it must rely on the OS's own continuous autofocus and ask the user to physically move toward better light (§6). |

Detail and sourcing below.

---

## 2. Native `BarcodeDetector` API: support matrix

The API is defined by the [W3C WICG "Shape Detection API" incubation](https://github.com/WICG/shape-detection-api) (`BarcodeDetector`, `FaceDetector`, `TextDetector`) — a CG-DRAFT, **not** an approved W3C standard or on the standards track. Per the spec repo's own `BarcodeFormat` enum, the full symbology list it defines is: `aztec`, `code_128`, `code_39`, `code_93`, `codabar`, `data_matrix`, `ean_13`, `ean_8`, `itf`, `pdf417`, `qr_code`, `unknown`, `upc_a`, `upc_e`. ([WICG/shape-detection-api `index.bs`](https://github.com/WICG/shape-detection-api/blob/main/index.bs))

**Per-browser support** (per [MDN's `browser-compat-data` for `BarcodeDetector`](https://github.com/mdn/browser-compat-data/blob/main/api/BarcodeDetector.json)):

| Browser | Status |
|---|---|
| Chrome (macOS/ChromeOS) | Supported since v83, expanded platform coverage from v88 |
| Chrome for Android | Supported since v83 |
| Edge | Supported since v83 (macOS only — Chromium's own platform-support table, below, has no Windows backend) |
| Opera | Supported since v69 (macOS only) |
| Firefox / Firefox for Android | **Not implemented** |
| Safari (macOS) | v17+ **only behind a manually-enabled "Shape Detection API" experimental feature flag** — not on by default |
| Safari on iOS | Mirrors desktop Safari: same flag-gated, off-by-default status |

This lines up with the API's own [platform support matrix in the WICG repo README](https://github.com/WICG/shape-detection-api/blob/main/README.md): the underlying OS-level detector backends are only wired up for **macOS (software) and Android (software)** — there's no Windows or Linux backend for barcode/QR detection at all, only for face/text detection on Windows.

**Current WebKit position:** WebKit's own [`standards-positions` issue #174](https://github.com/WebKit/standards-positions/issues/174) (opened by a Google engineer, April 2023) carries the label `position: support`, alongside `concerns: duplication` and `concerns: use cases` — i.e., WebKit is not opposed in principle, and "changes related to this specification have started to land in WebKit," but there is no committed shipping timeline, and two years-plus after the position was recorded it remains flag-gated and off by default.

**It is not just unshipped — it's actively broken where it does exist.** Apple's own developer forums have a thread, ["Shape Detection API (Barcode Detector) - Safari 18.X"](https://developer.apple.com/forums/thread/767761), reporting that the experimental flag that worked in Safari 17.x stopped working entirely after the iOS 18.0 update — barcode detection fails immediately for anyone who had it enabled, with no available workaround, tracked by a confirmed WebKit bug ([bugs.webkit.org #281848](https://bugs.webkit.org/show_bug.cgi?id=281848)).

**Bottom line for Hyllan:** relying on native `BarcodeDetector`, even with a feature check and manual-fallback message, is a non-starter for the stated primary use case (scanning groceries on a phone, where iPhone/Safari is a likely large share of households). A JS-level fallback isn't optional polish here — it's the only path that reaches Safari/iOS users at all today.

---

## 3. The better pattern: a `BarcodeDetector`-shaped polyfill, not a bespoke fallback library

Because the native API is a real (if patchy) standard with a defined interface, the cleanest engineering answer isn't "pick between the native API and a totally different fallback library's API" — it's to use a package that **implements the exact same interface** as a polyfill, so Hyllan's scanning code only ever talks to `window.BarcodeDetector`, regardless of whether the browser provides it natively or the polyfill installs it.

**[`barcode-detector`](https://www.npmjs.com/package/barcode-detector)** (GitHub: [`Sec-ant/barcode-detector`](https://github.com/Sec-ant/barcode-detector)) does exactly this:

- **What it is:** "A Barcode Detection API ponyfill/polyfill that uses ZXing-C++ WebAssembly under the hood," offering three import modes — a pure ponyfill (explicit import, no globals touched), a polyfill (registers `window.BarcodeDetector` only if not already present, via `??=`-style logic — it never overrides or extends an existing native implementation), or both combined.
- **Decoding engine:** [`zxing-wasm`](https://www.npmjs.com/package/zxing-wasm), a WebAssembly build of `zxing-cpp` (the actively maintained C++ successor to the original Java ZXing, Apache-2.0 licensed) published as an ES/CJS module with TypeScript types, by the same maintainer.
- **Format coverage:** 50+ formats via the library's own three-tier list — including every symbology Hyllan needs: `ean_13`, `ean_8`, `upc_a`, `upc_e`, plus `qr_code`/other matrix formats and convenience groups like `linear_codes`/`retail_codes` for requesting a curated symbology set instead of listing each one.
- **Maintenance:** genuinely current — npm shows the latest published version (`3.2.2`) went out on **2026-08-16** (the day before this research), and the GitHub commit history shows a steady, automated cadence (Renovate dependency bumps, Changesets releases) through August 2026. This is a materially better maintenance signal than any of the alternatives in §4.
- **License:** MIT for the wrapper, Apache-2.0 for the underlying `zxing-cpp` — both fully permissive, no LGPL/copyleft concerns (contrast with the `@undecaf/barcode-detector-polyfill` alternative, which is MIT itself but depends on `@undecaf/zbar-wasm`, which is LGPL).
- **Size trade-off:** the npm package itself is small (~255 KB unpacked), but a `.wasm` binary is fetched at runtime for actual decoding — reported WASM binary sizes range from ~636 KiB (reader-only build) up to ~1.3+ MiB for the full reader+writer build, so Hyllan should pick the narrowest build/subpath that covers just the symbologies it needs and make sure that fetch is deferred until the user actually opens the scanning UI (not part of the initial page bundle).
- **Performance:** WebAssembly barcode decoders are reported to run roughly **2× faster than pure-JS decoders** (a recurring claim across zxing-wasm's own positioning and third-party comparisons) — relevant because 1D barcode decoding from a live camera stream is a per-frame, CPU-bound loop, and phone CPUs (especially mid-range Android) are the actual bottleneck in practice.

**A related but distinct option**, `@undecaf/barcode-detector-polyfill`, does the same job with `zbar-wasm` (a WASM build of the ZBar C library) instead of `zxing-wasm`. It's a legitimate alternative shape but has the LGPL dependency noted above and less momentum in search/ecosystem signals than the Sec-ant package; not recommended as the first choice but worth knowing about if `zxing-wasm`-based decoding underperforms on a specific real-world barcode set.

---

## 4. Fallback / alternative libraries compared

| Library | Maintenance status | Approx. size | 1D (EAN-13/UPC-A) quality | Notes |
|---|---|---|---|---|
| **`barcode-detector`** (`Sec-ant`, npm `barcode-detector`) | **Active** — latest release 2026-08-16, automated Renovate/Changesets pipeline | ~255 KB pkg + ~0.6–1.3 MB WASM binary (fetched at runtime, cacheable) | Full parity with native `BarcodeDetector`'s format list, incl. `ean_13`/`ean_8`/`upc_a`/`upc_e` | **Recommended** — see §3 |
| `@zxing/library` + `@zxing/browser` (ZXing-js) | **Maintenance mode.** README: "we do not have the time to actively maintain zxing-js anymore... open to new maintainers." Commits continue but are contributed-patch-driven, not roadmap-driven. `@zxing/browser` last real feature commit April 2026, `@zxing/library` April 2026 | `@zxing/library` unpacked ~11.9 MB (mostly source/docs — actual bundled JS is far smaller; exact minified/gzip figure could not be independently measured, see caveat below) | Explicitly documents solid support for UPC-A, UPC-E, EAN-8, EAN-13, Code 39/93/128, Codabar, ITF; flags MaxiCode/Micro-QR as needing more testing and RSS-Expanded as "not production ready" | Most-downloaded pure-JS option (~1.17M weekly downloads per npm trends), pure JavaScript (no WASM step/build complexity), TypeScript port of the original Java ZXing. Reasonable fallback if the team prefers to avoid a WASM dependency, but is the *slower-moving* of the two ZXing-derived options above |
| `@ericblade/quagga2` (Quagga2) | **Actively maintained** — commits as recent as June 2026; volunteer-maintained fork of the abandoned original QuaggaJS (last released 2017) | Unpacked ~3.7 MB, single production dependency (`gl-matrix`) | Purpose-built for 1D: explicitly lists EAN, EAN-8, UPC-A, UPC-E, Code 128/39/93, Codabar, I2of5, etc. | **No QR/2D support at all** — a real gap only if Hyllan ever wants to scan a QR code (e.g. a manufacturer QR promo code), not a gap for the stated EAN-13/UPC-A/EAN-8 use case. Lower download volume (~24K/week) than the ZXing-derived packages, but healthiest recent commit cadence of any option here |
| `html5-qrcode` | **Maintenance mode "until further notice."** README states PRs "won't be merged for the time being," and the author is soliciting new owners. Real commit activity stalled well over a year before a single Dec-2025 README-only commit | Unpacked ~2.6 MB, no production dependencies | Supports EAN-13/EAN-8/UPC-A/UPC-E/UPC-EAN-EXTENSION plus Code 39/93/128, ITF, and 2D formats; built as a wrapper around ZXing-js, with an **experimental opt-in flag** (`experimentalFeatures.useBarCodeDetectorIfSupported`) to prefer the native `BarcodeDetector` when present | Widely used (~6.2K GitHub stars, ~205K–1.16M weekly downloads depending on the trends snapshot), but its own open issues (e.g. [#582](https://github.com/mebjas/html5-qrcode/issues/582), ["Poor performance... as compared to quaggaJS and scandit"](https://github.com/mebjas/html5-qrcode/issues/582)) and unresolved iOS-Safari-specific scanning bugs (e.g. [#512](https://github.com/mebjas/html5-qrcode/issues/512)) reinforce that this project isn't the strongest current pick |
| Dynamsoft Barcode Reader (JS SDK) | Actively maintained commercial product | N/A (proprietary, license-gated) | Commercial-grade; industry benchmarking (Dynamsoft's own blog) claims materially higher accuracy than ZXing-WASM on damaged/angled/low-quality real-world images | **Paid**, from ~$1,469 (per-scan-bundle license, e.g. 10K-scan renewal bundles around $1,371/yr) — a real ongoing cost, disproportionate for a self-hosted hobby-scale household app. Worth revisiting only if free options prove too unreliable in practice for Hyllan's actual grocery-packaging conditions |
| STRICH / Scanbot SDK | Actively maintained commercial products | N/A (proprietary, license-gated) | Marketed as outperforming ZXing-js/QuaggaJS specifically on worn/damaged barcodes and outdoor lighting conditions (vendor's own comparison page, so treat the accuracy claims as directional, not neutral) | Same cost-disproportion argument as Dynamsoft applies; not evaluated further here |

**Bundle-size caveat:** the network environment for this research blocked direct access to Bundlephobia, unpkg, and jsDelivr's size-reporting APIs (egress-proxy restriction), so the figures above are the npm-registry-reported *unpacked* package sizes (source + docs + build artifacts, not a minified/gzipped production bundle) rather than true shipped-bundle sizes. Before implementation, run each finalist candidate through the project's own bundler (or `bundlephobia.com`/`npm pack` locally) to get an exact minified+gzip number for whatever subset of the library actually gets imported.

---

## 5. Symbologies that matter for grocery/pantry packaging

- **EAN-13** — the international retail standard; per [GS1 US's own barcode-types page](https://www.gs1us.org/upcs-barcodes-prefixes/barcode-types), it's "the barcode most commonly scanned at retail endpoints such as grocery shops" outside North America, and it's what a Swedish household (a plausible primary Hyllan user base) will see on the overwhelming majority of packaged groceries.
- **UPC-A** — the US/Canada retail default (12-digit GTIN); still the standard on North American packaging, and effectively a subset/special case of EAN-13 (a UPC-A code is an EAN-13 with a leading `0`) — supporting `ean_13` format detection generally captures UPC-A too, but it's worth explicitly listing `upc_a` (and `upc_e`, its zero-suppressed short form) among requested formats for robustness, since decoders sometimes classify them separately.
- **EAN-8** — worth supporting. GS1's own guidance reserves EAN-8 specifically for packaging too small to fit a full EAN-13/UPC-A (per search-aggregated GS1/retail-barcode guidance: "very small items like candy, cosmetics, or stationery" require applying for a dedicated EAN-8), and pantry inventories plausibly include such small-format goods (spice jars, gum, small toiletries) — this is a real, not theoretical, format to support.
- **ITF-14** exists in the same GS1 family but is used on shipping cases/cartons, not individual retail units — not worth prioritizing for a per-item pantry scan, though it costs little to include if a chosen library supports it for free (all of the fallback libraries surveyed above do).
- **GS1 DataBar / DataBar Expanded** (mentioned in some library comparisons, e.g. html5-qrcode's support list) show up mainly on variable-weight items (fresh produce/meat) and coupons — a plausible "nice to have later" but not a first-priority format.

**Recommendation:** request `["ean_13", "upc_a", "upc_e", "ean_8"]` (or the `retail_codes`/`linear_codes` convenience group, if using `barcode-detector`) as the initial supported-formats set — this covers essentially all real grocery packaging without paying the decode-time cost of also scanning for QR/Data Matrix/PDF417 on every frame.

---

## 6. Practical accuracy/performance considerations for phone-browser camera scanning

- **Camera selection is solid everywhere.** `facingMode: 'environment'` (request the rear/back camera) is a [well-established `getUserMedia` constraint](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/facingMode) supported broadly since 2017, including in Safari/iOS — this part of the camera pipeline is not a cross-browser risk.
- **Torch (flashlight) control is Chrome/Android-only.** The `torch` capability, part of the [W3C Image Capture / `MediaTrackConstraints` extensions](https://www.w3.org/TR/image-capture/), is only actually implementable via `applyConstraints({advanced: [{torch: true}]})` on Chromium/Android; **Safari does not implement it at all**, on macOS or iOS. Practically: Hyllan cannot offer a "tap to turn on flashlight while scanning" button that works on iPhone — the best available fallback is a UI hint asking the user to move toward better light or use the phone's own Control-Center flashlight toggle outside the browser.
- **Focus control is likewise Chrome/Android-only.** `focusMode`/`focusDistance` constraints work on Chrome for Android but are not exposed on desktop Chrome or on iOS Safari at all — on iPhone, the app is entirely dependent on the OS/browser's own continuous-autofocus behavior with no programmatic "tap to focus" override, meaning users must be prompted to physically hold the phone still and let native autofocus settle rather than relying on the app to force focus.
- **Lighting, distance, and angle matter more than library choice.** Recurring, consistent guidance across scanning-tips sources: keep the phone roughly parallel to the barcode (avoid steep angles), hold it close enough that the code fills a reasonable portion of the frame but not so close autofocus can't lock, and ensure even, non-glary lighting — direct light source overhead often works better than a phone's own weak flash reflecting off glossy packaging.
- **Decode loop cost is real on lower-end devices.** All the JS/WASM decoders here run a per-video-frame decode loop (not a single still capture); WASM-based decoders (`zxing-wasm`) are reported to run roughly 2× faster than pure-JS decoders (§3), which matters directly for perceived scan latency on mid-range Android hardware — worth budgeting a debounce/frame-skip interval (a common pattern in these libraries defaults to scanning roughly every 300–500 ms rather than every animation frame) to avoid pegging the CPU and draining battery during an open scanning session.
- **These libraries decode one barcode per frame.** Both Quagga2 and html5-qrcode are documented as returning a single barcode per scan call — fine for Hyllan's "scan one item, confirm, scan next" batch-entry flow (which is the actual use case per PER-274), but worth knowing if a future feature ever wants "scan a shelf of items at once."
- **Real-world accuracy is genuinely lower than QR-code demos suggest for 1D codes on curved/glossy grocery packaging** — this is echoed across multiple sources (STRICH's competitive positioning, the html5-qrcode "poor performance" issue thread, Dynamsoft's own benchmark marketing) even allowing for vendor bias in the commercial sources: expect to need decode-time-out/retry UX and a manual barcode-entry fallback regardless of which library is chosen, not just for browsers without camera access.

---

## Sources

- [WICG Shape Detection API — GitHub repo](https://github.com/WICG/shape-detection-api)
- [WICG/shape-detection-api `index.bs` (spec source, `BarcodeFormat` enum)](https://github.com/WICG/shape-detection-api/blob/main/index.bs)
- [WICG/shape-detection-api `README.md` (platform support table)](https://github.com/WICG/shape-detection-api/blob/main/README.md)
- [MDN `browser-compat-data`: `api/BarcodeDetector.json`](https://github.com/mdn/browser-compat-data/blob/main/api/BarcodeDetector.json)
- [MDN `content`: Barcode Detection API page source](https://github.com/mdn/content/blob/main/files/en-us/web/api/barcode_detection_api/index.md)
- [WebKit `standards-positions` issue #174 — Accelerated Shape Detection in Images](https://github.com/WebKit/standards-positions/issues/174)
- [Apple Developer Forums: "Shape Detection API (Barcode Detector) - Safari 18.X"](https://developer.apple.com/forums/thread/767761)
- [WebKit Bugzilla #281848](https://bugs.webkit.org/show_bug.cgi?id=281848)
- [`barcode-detector` npm package](https://www.npmjs.com/package/barcode-detector) / [GitHub `Sec-ant/barcode-detector`](https://github.com/Sec-ant/barcode-detector)
- [`zxing-wasm` npm package](https://www.npmjs.com/package/zxing-wasm) / [GitHub `Sec-ant/zxing-wasm`](https://github.com/Sec-ant/zxing-wasm)
- [`zxing-cpp` GitHub repo and LICENSE](https://github.com/zxing-cpp/zxing-cpp/blob/master/LICENSE)
- [`@undecaf/barcode-detector-polyfill` — npm / GitHub](https://github.com/undecaf/barcode-detector-polyfill)
- [`@zxing/library` npm package](https://registry.npmjs.org/@zxing/library) / [GitHub `zxing-js/library`](https://github.com/zxing-js/library) (README maintenance-mode statement, commit history)
- [`@zxing/browser` npm package](https://registry.npmjs.org/@zxing/browser) / [GitHub `zxing-js/browser`](https://github.com/zxing-js/browser) (commit history)
- [`zxing-js/library` issue #580 — zxing-wasm as an alternative](https://github.com/zxing-js/library/issues/580)
- [`@ericblade/quagga2` npm package](https://registry.npmjs.org/@ericblade/quagga2) / [GitHub `ericblade/quagga2`](https://github.com/ericblade/quagga2) (README format list, commit history)
- [`html5-qrcode` npm package](https://registry.npmjs.org/html5-qrcode) / [GitHub `mebjas/html5-qrcode`](https://github.com/mebjas/html5-qrcode) (README maintenance-mode statement, format list, native-`BarcodeDetector` opt-in)
- [`html5-qrcode` issue #582 — poor performance vs QuaggaJS/Scandit](https://github.com/mebjas/html5-qrcode/issues/582)
- [`html5-qrcode` issue #512 — iOS Safari scanning failures](https://github.com/mebjas/html5-qrcode/issues/512)
- [ComponentSource: Dynamsoft Barcode Reader pricing](https://www.componentsource.com/product/barcode-reader/prices)
- [STRICH: Comparison to ZXing and QuaggaJS](https://strich.io/strich-compared-to-zxing-js-and-quagga/)
- [Scanbot: Quagga2 vs. html5-qrcode scanner](https://scanbot.io/blog/quagga2-vs-html5-qrcode-scanner/)
- [GS1 US: Types of Barcodes](https://www.gs1us.org/upcs-barcodes-prefixes/barcode-types)
- [MDN: `MediaTrackSettings.facingMode`](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/facingMode)
- [W3C: MediaStream Image Capture (torch capability)](https://www.w3.org/TR/image-capture/)
- npm registry data for package versions/publish dates/dependencies: `@zxing/browser`, `@zxing/library`, `@ericblade/quagga2`, `html5-qrcode`, `barcode-detector`, `zxing-wasm`
