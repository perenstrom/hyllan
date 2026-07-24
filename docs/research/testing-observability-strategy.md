# Research: Testing and observability strategy for self-hosted MVP

**Ticket:** [PER-219 — Specify testing/observability strategy for self-hosted MVP](https://linear.app/per-enstrom/issue/PER-219/specify-testingobservability-strategy-for-self-hosted-mvp) (child of PER-212, "Hyllan — pantry inventory MVP spec")

**Scope:** Automated testing and observability are unaddressed decisions for the MVP spec. This note researches the *shape* of both — proportionate test levels (unit/integration/e2e) building on the repo's already-configured Vitest setup, and minimal logging/error-tracking/uptime-check tooling for the single-VPS Docker Compose deployment locked in PER-215's deployment architecture research (single Compose stack: `app`/`db`/`proxy`, Caddy, pg_dump backups, ~2vCPU/4GB VPS) — against primary sources only.

---

## 1. Recommendations (summary)

| Question | Recommendation |
|---|---|
| Unit/component testing | Keep **Vitest + React Testing Library**, already configured in this repo (`vitest.config.ts`, `@testing-library/react`). No reason to introduce a second unit-test runner. |
| Integration testing (Drizzle/Postgres) | **Vitest + PGlite** (`@electric-sql/pglite`) — an in-process WASM Postgres — for tests that need real Postgres semantics (queries, constraints, cascades) without Docker or network overhead. |
| End-to-end testing | **Playwright**, Next.js's own recommended E2E tool, for the small set of critical user flows (signup → household creation, add/update pantry item) and for anything involving `async` Server Components, which Vitest does not support. |
| Test proportion for a solo MVP | Heavy on unit/component tests for domain logic (quantity/unit rules, uniqueness-by-name), a handful of PGlite-backed integration tests for Drizzle queries and cascades, and a thin Playwright suite (single digits) covering only the flows that would be embarrassing to break. Skip snapshot testing and cross-browser E2E matrices at this scale. |
| Structured logging | **Pino**, writing JSON to stdout (its own recommended default), captured by Docker's log driver — no separate log shipping infrastructure needed at this scale. |
| Postgres logging | Keep Postgres's own `log_destination = stderr` default so logs flow into `docker compose logs` like every other service; turn on `log_min_duration_statement` for slow-query visibility. |
| Docker/Caddy log hygiene | Bound `json-file` log growth with `max-size`/`max-file` log-opts per service; use Caddy's built-in JSON access-log with size/time-based rolling. |
| Error tracking | **GlitchTip**, self-hosted — a Sentry-API-compatible error tracker with a ~256 MB RAM footprint, versus full self-hosted Sentry's documented 16 GB+ RAM / 4 CPU minimum, which is disproportionate to a 4 GB VPS running the whole app stack. Wire it up via the official `@sentry/nextjs` SDK (GlitchTip accepts standard Sentry SDKs) plus Next.js's `onRequestError` instrumentation hook. |
| Uptime/health checks | Docker Compose **`healthcheck`** blocks per service (feeding `depends_on: condition: service_healthy`) for container-level health, plus a simple `/api/health` Route Handler for app-level checks. For external uptime monitoring, use **GlitchTip's built-in uptime/heartbeat monitor** rather than standing up a fourth tool — it already exists once GlitchTip is deployed for error tracking. |

Detail and sourcing for each below.

---

## 2. Testing: what level is proportionate

Next.js's own testing guide categorizes tests into unit, component, integration, E2E, and snapshot testing, and its guidance on async Server Components is explicit and load-bearing for this stack: "Since `async` Server Components are new to the React ecosystem, some tools do not fully support them. In the meantime, we recommend using **End-to-End Testing** over **Unit Testing** for `async` components." ([Next.js: Testing](https://nextjs.org/docs/app/guides/testing)) The Vitest-specific guide repeats the same caveat verbatim and adds: "you can still run **unit tests** for synchronous Server and Client Components." ([Next.js: How to set up Vitest with Next.js](https://nextjs.org/docs/app/guides/testing/vitest))

Since most of Hyllan's App Router pages will be `async` Server Components fetching data via Drizzle, this has a concrete consequence: page-level rendering can't be meaningfully unit-tested with Vitest today. That pushes page/flow-level coverage to Playwright, while Vitest's job narrows to (a) pure domain logic (quantity/unit validation, name-uniqueness normalization) and (b) synchronous/client components (forms, interactive widgets).

For a single-developer MVP, this repo already has the right unit-test runner installed (Vitest + `@testing-library/react`, `jsdom` environment — see `vitest.config.ts`, `vitest.setup.ts`), so there's no reason to introduce Jest, Cypress, or another runner. Next.js documents four "commonly used testing tools" (Cypress, Jest, Playwright, Vitest) without ranking one as canonical beyond the async-component distinction ([Next.js: Testing](https://nextjs.org/docs/app/guides/testing)) — Vitest for unit/component plus Playwright for E2E is a fully documented, first-party-supported combination, not a compromise.

**Proportion guidance for this scale:** favor unit tests for anything with actual business rules (the domain model in `CONTEXT.md` — quantity validation, case-insensitive name uniqueness, household cascade-delete semantics) since those are cheap, fast, and exercise the logic Hyllan actually differentiates on. Integration tests earn their cost specifically where Drizzle queries or Postgres constraints do work that unit tests can't fake convincingly (uniqueness constraints, cascade deletes, transactions) — a small number of targeted tests, not full CRUD coverage. E2E tests are the most expensive per test to write and maintain, so keep the suite to the flows whose breakage would be a real incident: signup/auth (through self-hosted Supabase Auth), adding a pantry item, and the core household boundary. Skip snapshot testing (Next.js lists it as a type but doesn't push it) and skip a cross-browser Playwright matrix — Playwright defaults to Chromium/Firefox/WebKit ([Next.js: How to set up Playwright with Next.js](https://nextjs.org/docs/app/guides/testing/playwright)), but running one browser in CI is enough at this scale; the multi-browser matrix is a hedge against a browser-market-share problem this app doesn't have yet.

---

## 3. Integration testing against Drizzle/Postgres

**Recommendation:** use **PGlite** (`@electric-sql/pglite`) as the Postgres backend for integration tests run under Vitest, rather than Testcontainers or a shared dev database.

Drizzle's own documentation describes PGlite as "a WASM Postgres build packaged into a TypeScript client library that enables you to run Postgres in the browser, Node.js and Bun, with no need to install any other dependencies" — a genuine Postgres engine (compiled to WebAssembly), not an emulation layer, usable as an ephemeral in-memory database or with file-system persistence. ([Drizzle ORM: PGLite](https://orm.drizzle.team/docs/connect-pglite)) Setup is minimal: `drizzle-orm` plus the `@electric-sql/pglite` driver, then `drizzle({ client: new PGlite() })` for an in-memory instance. ([Drizzle ORM: PGLite](https://orm.drizzle.team/docs/connect-pglite))

This is the right default for a solo-developer MVP because it needs no Docker daemon, no network hop, and starts near-instantly per test file — important for a fast unit/integration feedback loop under `vitest --watch`. The main alternative, **Testcontainers for Node.js**, spins up a real containerized `postgres` image per test run via `PostgreSqlContainer` and exposes a connection URI (`container.getConnectionUri()`) for a client or ORM to connect to. ([Testcontainers Node.js: PostgreSQL module](https://node.testcontainers.org/modules/postgresql/)) That's the more faithful option if a test ever needs a Postgres extension or behavior PGlite's WASM build doesn't support, but it requires Docker-in-CI and pays a container-startup cost per run — worth reaching for only if a specific test needs it, not as the default.

Drizzle does not otherwise publish a first-party testing strategy doc beyond a `drizzle.mock()` helper for a typed DB object with no real connection (useful for pure unit tests that stub the DB layer entirely, not for integration coverage). ([Drizzle ORM: Goodies](https://orm.drizzle.team/docs/goodies))

**Practical shape:** integration tests instantiate a PGlite-backed Drizzle client, run the project's actual Drizzle migrations (or `pushSchema` for speed) against it per test file/suite, and assert on real query results — closing the gap that pure unit tests leave around uniqueness constraints, cascades, and transactional behavior.

---

## 4. End-to-end testing

**Recommendation:** Playwright, per Next.js's own guide, for the small set of critical user flows.

Next.js documents Playwright specifically for E2E: "Playwright is a testing framework that lets you automate Chromium, Firefox, and WebKit with a single API. You can use it to write **End-to-End (E2E)** testing." ([Next.js: How to set up Playwright with Next.js](https://nextjs.org/docs/app/guides/testing/playwright)) Setup is `npm init playwright`, which scaffolds a `playwright.config.ts`. Next.js's own guidance is to "run your tests against your production code to more closely resemble how your application will behave" — i.e. `next build && next start`, then `npx playwright test` — with an alternative of Playwright's `webServer` option to have Playwright manage starting the dev/prod server itself. ([Next.js: How to set up Playwright with Next.js](https://nextjs.org/docs/app/guides/testing/playwright))

This is the tool that actually exercises the parts Vitest can't reach for this app: `async` Server Components (per §2), and full-stack flows through self-hosted Supabase Auth (GoTrue) where a real browser session/cookie flow matters more than component-level mocking.

---

## 5. Structured logging

**Recommendation:** **Pino** for application logs, writing JSON to stdout by default, with Postgres and Caddy left to their own default stderr/access-log output — all captured uniformly by Docker's per-service log driver. No separate log-shipping stack (ELK, Loki, etc.) at this scale.

Pino's own documentation states the performance-oriented default plainly: "The best performance for logging directly to stdout is *usually* achieved by using the default configuration," and explicitly recommends *not* doing transport/shipping in-process — "it's highly recommended that sending, alert triggering, reformatting, and all forms of log processing are conducted in a separate process or thread," pointing to `pino.transport` (worker-thread based) rather than custom in-process shipping code, and favoring "common, preexisting, system utilities" (e.g. `logrotate`) over reinventing them. ([Pino: help docs](https://github.com/pinojs/pino/blob/main/docs/help.md), [Pino: README](https://github.com/pinojs/pino/blob/main/README.md)) That philosophy matches this deployment exactly: the app container's job is to emit structured JSON lines to stdout; Docker's own logging layer is the "separate process" that owns collection.

For Postgres, PostgreSQL's own docs list `log_destination`'s default as `stderr` ([PostgreSQL: Error Reporting and Logging](https://www.postgresql.org/docs/current/runtime-config-logging.html)) — since the official `postgres` image runs the server as the container's foreground process, that stderr output is exactly what `docker compose logs db` captures, with no extra configuration required to get baseline visibility. Worth turning on explicitly for a small production instance, per the same docs: `log_min_duration_statement` (log any statement exceeding a duration threshold — useful for catching slow queries before they become a user-visible problem) and `log_lock_waits` (surface lock contention). Structured `csvlog`/`jsonlog` output ([PostgreSQL: Error Reporting and Logging](https://www.postgresql.org/docs/current/runtime-config-logging.html)) is more machinery than this scale needs — plain stderr lines captured by Docker are sufficient until there's an actual need to query logs as data.

Caddy logs access requests to stderr by default, auto-selecting JSON format when stderr isn't a terminal — i.e. under Docker, Caddy's default behavior is already structured JSON. ([Caddy: `log` directive](https://caddyserver.com/docs/caddyfile/directives/log)) No extra config needed to get structured proxy logs; file-based output with `roll_size`/`roll_keep`/`roll_keep_for` is documented if disk-persisted access logs are ever wanted, but stderr-into-Docker is enough for MVP.

**Docker-level log hygiene:** Docker's default `json-file` log driver does not rotate by itself and "doesn't perform log rotation, potentially causing significant disk space consumption for verbose containers" — bounded via `max-size`/`max-file` log-opts, either daemon-wide (`daemon.json`) or per-service. ([Docker: Configure logging drivers](https://docs.docker.com/engine/logging/configure/)) On a 40 GB-class VPS running three-plus containers indefinitely, setting a `max-size`/`max-file` per service in `compose.yaml` is a cheap, concrete guard against an unbounded log filling the disk — directly relevant given the deployment doc's VPS-sizing constraints.

---

## 6. Error tracking

**Recommendation:** **GlitchTip**, self-hosted in the same Docker Compose stack, wired up via the standard `@sentry/nextjs` SDK and Next.js's `onRequestError` instrumentation hook. Not self-hosted Sentry.

Self-hosted Sentry's own documentation states hard minimums that rule it out for this VPS class: "4 CPU cores," "16 GB RAM + 16 GB swap" (32 GB recommended), and "20 GB free disk space," running as a multi-service Docker Compose stack that itself includes "databases, message brokers, and other services on a single machine," with a further note that it "relies heavily on disk I/O." ([Sentry: Self-Hosted Sentry](https://develop.sentry.dev/self-hosted/)) That's larger than the entire VPS this app is deployed on (2 vCPU / 4 GB, per the deployment architecture doc) — self-hosted Sentry is simply the wrong tool at this scale, regardless of its feature set.

GlitchTip is positioned as a lighter, Sentry-API-compatible alternative: its own install docs state a minimum of "256 MB RAM when using all-in-one setup," with "careful configuration" allowing 128 MB + swap, 512 MB recommended, and it depends only on Postgres (already in this stack) plus optionally Redis/Valkey. ([GlitchTip: Install](https://glitchtip.com/documentation/install)) Its own SDK docs point developers to standard Sentry SDK setup — "our general SDK setup instructions for getting started with any Sentry-compatible SDK" — meaning the official `@sentry/nextjs` package (the same one Sentry's own docs describe installing via `npx @sentry/wizard@latest -i nextjs`, generating client/server/edge config files and wiring `instrumentation.ts`) works against a GlitchTip DSN with no custom SDK. ([GlitchTip: SDK docs](https://glitchtip.com/sdkdocs/all-sdks), [Sentry: Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)) The one documented gap: "GlitchTip does not support session tracking" ([GlitchTip: SDK docs — all SDKs](https://glitchtip.com/sdkdocs/all-sdks)) — session replay and similarly heavy SaaS-oriented features are out of scope, which is an acceptable trade for a pantry app at MVP, not a blocker.

Next.js's own instrumentation docs describe exactly the hook this wiring needs: an optional `onRequestError` export in `instrumentation.ts`, called whenever "the Next.js server captures the error," receiving the error, request path/method/headers, and route context (router kind, route path, whether it happened in rendering/a Route Handler/a Server Action) — documented as the mechanism for sending "server errors to any custom observability provider." ([Next.js: instrumentation.js — onRequestError](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)) In practice, the Sentry Next.js wizard sets this up automatically as part of its instrumentation scaffolding; the point worth flagging for the spec is that this hook — not a bespoke try/catch layer — is Next.js's documented integration point for error tracking.

**Why this over rolling your own:** GlitchTip also runs one clean Docker Compose service (or a small handful — app + worker + its own dependency on Postgres) rather than Sentry's multi-service footprint, and doesn't introduce a new hosted-vendor dependency beyond what's already locked in (Supabase Auth) — it's self-hosted, open-source, and uses a DSN you own.

---

## 7. Uptime and health checks

**Recommendation:** Docker Compose `healthcheck` blocks for container-level liveness (feeding `depends_on: condition: service_healthy` ordering), a simple `/api/health` Next.js Route Handler for an application-level check, and GlitchTip's own built-in uptime monitor for external "is the site up" checks — rather than adding a fourth, separate uptime tool.

Docker's own Dockerfile reference documents the `HEALTHCHECK` instruction's shape and defaults: `HEALTHCHECK [OPTIONS] CMD <command>`, with `--interval=30s`, `--timeout=30s`, `--start-period=0s`, `--start-interval=5s`, `--retries=3`, and exit-code semantics of `0` (healthy) / `1` (unhealthy) / `2` (reserved). ([Docker: Dockerfile reference — HEALTHCHECK](https://docs.docker.com/reference/dockerfile/)) The Compose file reference documents the equivalent `healthcheck` service field (`test`, `interval`, `timeout`, `retries`, `start_period`) and its interaction with dependency ordering: "Compose guarantees dependency services marked with `service_healthy` are 'healthy' before starting a dependent service" when used with `depends_on: condition: service_healthy`. ([Docker Compose: Compose file reference — healthcheck](https://docs.docker.com/reference/compose-file/services/#healthcheck)) For this stack that means the `app` service can be configured to wait for `db` to report healthy (e.g. via `pg_isready`) before starting, rather than relying on Compose's plain startup-order guarantee, which says nothing about whether Postgres has finished accepting connections.

For an application-level check, Next.js Route Handlers are the documented mechanism for a simple endpoint returning arbitrary JSON/status from a `GET` handler (`export async function GET() { return Response.json(...) }`), including reading the DB or other dependencies before responding. ([Next.js: route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route)) There's no dedicated Next.js "health check" doc — this is a standard use of the general Route Handler mechanism, worth calling out explicitly in the spec so it's built as a real dependency check (e.g. a trivial Drizzle query) rather than a static 200.

For **external** uptime monitoring (is the whole VPS/site reachable from outside), GlitchTip's own product page documents a built-in uptime-check feature, in both directions: "GlitchTip can ping your site and warn you when it's not responding," or, reversed, "send GlitchTip a request on schedule. If GlitchTip doesn't receive your ping, it will send you an alert via email or webhook" (heartbeat/check-in style, useful for cron jobs like the backup script from the deployment architecture doc). ([GlitchTip homepage](https://glitchtip.com)) Since GlitchTip is already being deployed for error tracking (§6), using its built-in uptime monitor avoids standing up a separate tool. A dedicated self-hosted alternative exists if a public status page or richer check types (TCP, DNS, keyword-in-body, etc.) are ever wanted — **Uptime Kuma** is a self-hosted monitoring tool supporting HTTP(S), TCP, DNS, ping, and Docker-container checks, deployable via Docker Compose. ([Uptime Kuma: README](https://github.com/louislam/uptime-kuma)) Not needed for MVP given GlitchTip already covers the "is it up" question.

---

## Sources

- [Next.js: Testing (overview)](https://nextjs.org/docs/app/guides/testing)
- [Next.js: How to set up Vitest with Next.js](https://nextjs.org/docs/app/guides/testing/vitest)
- [Next.js: How to set up Playwright with Next.js](https://nextjs.org/docs/app/guides/testing/playwright)
- [Next.js: route.js (Route Handlers)](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Next.js: How to set up instrumentation](https://nextjs.org/docs/app/guides/instrumentation)
- [Next.js: instrumentation.js (onRequestError reference)](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
- [Drizzle ORM: PGLite](https://orm.drizzle.team/docs/connect-pglite)
- [Drizzle ORM: Goodies (drizzle.mock)](https://orm.drizzle.team/docs/goodies)
- [Testcontainers for Node.js: PostgreSQL module](https://node.testcontainers.org/modules/postgresql/)
- [PostgreSQL: Error Reporting and Logging](https://www.postgresql.org/docs/current/runtime-config-logging.html)
- [Docker: Configure logging drivers](https://docs.docker.com/engine/logging/configure/)
- [Docker: Dockerfile reference (HEALTHCHECK)](https://docs.docker.com/reference/dockerfile/)
- [Docker Compose: Compose file reference (healthcheck)](https://docs.docker.com/reference/compose-file/services/#healthcheck)
- [Caddy: `log` directive](https://caddyserver.com/docs/caddyfile/directives/log)
- [Pino: help docs](https://github.com/pinojs/pino/blob/main/docs/help.md)
- [Pino: README](https://github.com/pinojs/pino/blob/main/README.md)
- [Sentry: Self-Hosted Sentry](https://develop.sentry.dev/self-hosted/)
- [Sentry: Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [GlitchTip: Install](https://glitchtip.com/documentation/install)
- [GlitchTip: SDK docs (all SDKs)](https://glitchtip.com/sdkdocs/all-sdks)
- [GlitchTip homepage (uptime monitoring)](https://glitchtip.com)
- [Uptime Kuma: README](https://github.com/louislam/uptime-kuma)
