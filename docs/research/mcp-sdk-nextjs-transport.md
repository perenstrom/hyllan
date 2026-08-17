# Research: Can Next.js Route Handlers host the MCP TypeScript SDK's Streamable HTTP transport?

**Ticket:** [PER-283](https://linear.app/per-enstrom/issue/PER-283) — child of the wayfinder map [PER-281, "MCP server for Hyllan"](https://linear.app/per-enstrom/issue/PER-281)

**Scope:** Pure fact-finding, against primary sources only. This note surfaces what the official MCP TypeScript SDK's Streamable HTTP transport requires from a host, whether a Next.js App Router Route Handler can be that host given Hyllan's deployment shape (`output: "standalone"`, self-hosted Node process behind Caddy — see `README.md` "Production deployment"), how bearer-token/OAuth auth plugs in, and what documented Next.js integrations exist. It does not make or recommend the design decision.

**A note on access:** `modelcontextprotocol.io` and `nextjs.org` were both blocked by this environment's network egress proxy. Both projects publish their docs' Markdown source in their GitHub repos, which is what this note cites instead — same content, source of truth rather than the rendered site. Exact commit SHAs are given per source so the citations stay reproducible as those repos move.

---

## 0. SDK version landscape (read this first — it changes the shape of every answer below)

Two materially different generations of the SDK and protocol are relevant right now (today: 2026-08-17):

| | **Current stable** | **Next generation** |
|---|---|---|
| SDK npm version | `@modelcontextprotocol/sdk` **1.30.0** (`dist-tags.latest` on the npm registry) | `@modelcontextprotocol/server`/`@modelcontextprotocol/sdk` **2.0.0-alpha.0**, on the `typescript-sdk` repo's `main` branch — unreleased |
| Protocol spec era | `2024-10-07` through `2025-11-25` ("legacy" era in the SDK's own terminology) | `2026-07-28` ("modern" era) — merged roughly three weeks before this research |
| Server HTTP entry point | `StreamableHTTPServerTransport` (Node) / `WebStandardStreamableHTTPServerTransport` (fetch-native), one instance per session | `createMcpHandler(factory)` returning `{ fetch }`, one fresh server instance per HTTP request |
| Session model | Sessions are a first-class transport feature (`Mcp-Session-Id`, `sessionIdGenerator`) | The modern era removes protocol-level sessions and the GET SSE stream entirely; `createMcpHandler` also serves 2025-era clients, but statelessly |

Anything a production Next.js MCP server would ship today is built on the **1.x, stable** line — that's what's on npm and what every dependent (`mcp-handler` 1.x, Claude Desktop, Claude.ai, etc.) currently interoperates with. The v2 rewrite is real, present in the SDK's own docs site, and already has a matching `mcp-handler` 2.x line and Vercel template — but it is alpha software, unreleased, and its "modern" 2026-07-28 protocol era is roughly three weeks old at the time of this research, so client-side support for it elsewhere in the ecosystem is unverified here. Both generations are covered below, clearly labeled, because the v2 direction materially changes the answer to "does this fit a Route Handler."

---

## 1. What does the Streamable HTTP transport require from its host?

### 1a. The protocol spec itself (both eras)

Per the official spec (repo `modelcontextprotocol/modelcontextprotocol`, commit `4df2d6b6e3`):

**2025-06-18 era** (`docs/specification/2025-06-18/basic/transports.mdx`) — the shape every current production client speaks:
- The server exposes one HTTP endpoint (e.g. `/mcp`) that supports **both POST and GET**.
- Every JSON-RPC message from the client is its own POST; the server answers each with either a single `application/json` body or a `text/event-stream` (SSE) response, client's choice which it accepts (must accept both).
- Session management is **optional** ("a server ... **MAY** assign a session ID at initialization time"), via an `Mcp-Session-Id` response header on `initialize`. If assigned, every later client request **MUST** carry it back; the server terminates a session by answering `404` to it.
- The client **MAY** also issue a standalone **GET** to open a long-lived SSE stream for server-initiated messages ("The server **MUST** either return `Content-Type: text/event-stream` ... or else return HTTP 405"). This is a genuinely open, held-open connection ("loop while connection remains open").
- Resumability (`Last-Event-ID` header, per-stream event IDs) is optional, server's choice.
- Security: servers **MUST** validate `Origin`; **SHOULD** bind to localhost only when running locally; **SHOULD** implement auth.

**2026-07-28 era** (`docs/specification/2026-07-28/basic/transports/streamable-http.mdx`) — the newest revision, changes flagged explicitly in the spec's own changelog note:
- **Removal of the GET stream endpoint** and **removal of protocol-level sessions** entirely. The endpoint now supports **POST only**; `Mcp-Session-Id` is gone.
- Each request gets its own response — either one JSON object or an SSE stream **scoped to that single request** — and the stream **SHOULD** close once the final response is sent.
- Long-lived server-initiated notifications move to an explicit opt-in: a client sends a `subscriptions/listen` POST, and *that* request's own response stream stays open for change notifications — a long-lived connection still exists in this era, but only for callers who explicitly ask for one, not as a baseline requirement of every session.
- `Last-Event-ID`/resumable streams are **not supported** in this revision ("Resumable SSE streams via `Last-Event-ID` are not supported").

So the "does this need long-lived connections?" answer depends on era: the still-dominant 2025 era makes an optional, session-scoped GET stream part of normal server-push behavior; the brand-new 2026 era collapses everything to per-request POST/response, with a long-lived stream only for a client that opts into `subscriptions/listen`.

### 1b. What the current stable SDK (1.30.0) actually asks of the host

Read directly from `src/server/streamableHttp.ts` and `src/server/webStandardStreamableHttp.ts` at tag `1.30.0` (commit `2d889f2b32`) in `modelcontextprotocol/typescript-sdk`:

- **Two modes, both supported by one class** (`WebStandardStreamableHTTPServerTransportOptions`):
  - **Stateless**: `sessionIdGenerator` left `undefined`. No `Mcp-Session-Id` is ever set or checked. But: *"In stateless mode... each request must use a fresh transport. Reusing a stateless transport causes message ID collisions between clients"* — the code throws (`'Stateless transport cannot be reused across requests. Create a new transport per request.'`) if you try. This is exactly the shape of a stateless per-invocation handler: **one new transport instance, wired to a fresh `McpServer`, per HTTP request.**
  - **Stateful**: `sessionIdGenerator: () => randomUUID()`. The transport itself *is* the session — it holds `sessionId`, an in-memory `_streamMapping` of open SSE streams, and (if configured) an `EventStore` for resumability. The **same transport object must be reused** across every request that carries that session's `Mcp-Session-Id`, which means the host needs a session→transport map (`Map<string, StreamableHTTPServerTransport>`) kept somewhere that survives between requests, and routes each incoming request to the right transport by that header.
- **The `handleRequest(req, res)` method handles all three verbs** — POST (JSON-RPC calls), GET (the standalone SSE stream — "Only one SSE stream is allowed per session" — a 409 if a second GET tries to open one), and DELETE (session termination, calls `close()`).
- **The GET stream, when opened, is a real held-open connection**: it creates a `ReadableStream` with a controller kept alive by an SSE keep-alive timer (`armSseKeepAlive`, default 15s comment-frame interval), and only closes on client disconnect, explicit `close()`, or session termination.
- **Multi-node/horizontal scaling requires shared state**: a stateful deployment's session map (and, for resumable streams, the `EventStore`) lives in one process's memory by default; scaling to more than one server instance needs either (a) session-affinity routing so a client's requests always land on the node holding its transport, or (b) a shared `EventStore` (the SDK ships only an in-memory reference implementation, `examples/shared/src/inMemoryEventStore.ts`, explicitly documented as "single-process only" in the v2 docs' equivalent page). `mcp-handler` 1.x's own README documents exactly this gap: *"Redis Integration: Optional, for SSE transport resumability"* (tag `v1.1.0`, `modelcontextprotocol/typescript-sdk`-compatible package `vercel/mcp-handler`).
- **Web-standard variant exists today, already.** `WebStandardStreamableHTTPServerTransport` (same repo, same tag) is explicitly documented in its own file header as working "on any runtime that supports Web Standards: Node.js 18+, Cloudflare Workers, Deno, Bun, etc.," taking a `Request` and returning a `Response` directly — no Express, no Node `IncomingMessage`/`ServerResponse`. `StreamableHTTPServerTransport` (the Node-`http`-shaped class most existing examples use) is a wrapper around this same core.

### 1c. What the v2 (alpha) rewrite changes

From the SDK's own v2 docs (`docs/serving/http.md`, `docs/serving/sessions-state-scaling.md`, commit `3e90449fd5` on `main`):

- `createMcpHandler(factory)` returns `{ fetch, close, notify, bus }`. `fetch` is `(Request) => Promise<Response>` — nothing Node-specific.
- **The factory runs once per HTTP request**, building a fresh `McpServer`; the handler "holds nothing between requests." Per the docs: *"Because no state lives on the instance, the endpoint is stateless and scales horizontally as-is."* This is the default and the whole point of the design — no session map to maintain for the modern (2026-07-28) protocol era.
- Legacy (2025-era) clients are still served, by default, from the *same* stateless factory, per request (`legacy: 'stateless'`) — but that means the legacy `GET` (standalone SSE stream) and `DELETE` (session termination) now answer `405 Method not allowed` unless you opt back into `sessionIdGenerator`-style stateful routing via `NodeStreamableHTTPServerTransport` for that leg specifically (`docs/serving/legacy-clients.md`, `docs/serving/sessions-state-scaling.md`).
- Scaling story, quoted directly: *"The stateless default is the scaling story: every node builds a fresh instance from the same factory and holds nothing between requests, so put the nodes behind any load balancer — no session affinity, nothing to share, nothing to configure."* Sessionful legacy deployments still need the same two scaling strategies as v1 (shared `eventStore`, or session-affinity routing) if run across multiple nodes.
- `responseMode: 'json' | 'sse'` on `createMcpHandler` pins the response shape instead of letting the handler choose per-call.

**Bottom line for section 1:** the transport is *not* inherently a long-lived-connection protocol at the request/response level — every message exchange is its own HTTP POST with either a JSON or an SSE-shaped response. The genuinely long-lived piece is the *optional* server-push stream (GET in 2025-era, `subscriptions/listen` in 2026-era), and *session state*, when a deployment chooses to be stateful. A server that skips both (stateless mode, no server-initiated push) is legitimately plain request/response per call, in both SDK generations, per the SDK's own primary documentation and source.

---

## 2. Is a Next.js Route Handler a viable host, given Hyllan's deployment?

Hyllan is self-hosted via Docker Compose with `output: "standalone"`, `next start` as a persistent Node process, behind Caddy — no edge runtime, no serverless functions (`README.md`, "Production deployment"; corroborated by `docs/research/deployment-architecture.md` in this repo).

Facts gathered from Next.js's own docs (repo `vercel/next.js`, commit `9e1dc0ebe4`, since `nextjs.org` itself was unreachable from this environment) and the SDK/ecosystem sources above:

- **Route Handlers are Web Standard `Request`/`Response` handlers.** Per `docs/01-app/03-api-reference/03-file-conventions/route.mdx`: *"Route Handlers allow you to create custom request handlers for a given route using the Web Request and Response APIs."* `GET`/`POST`/`DELETE`/etc. are all supported per-method exports with the exact `(request: Request) => Response | Promise<Response>` shape (or `NextRequest`, itself "an extension of the Web Request API").
- **Route Handlers support returning a `ReadableStream`-backed `Response` directly** — the same doc's "Streaming" section shows `return new Response(stream)` built from a `ReadableStream`, the identical mechanism `WebStandardStreamableHTTPServerTransport` and v2's `createMcpHandler` use internally for SSE.
- **Route segment config includes `export const runtime = 'nodejs'`** (same doc, "Segment Config Options") — Hyllan's whole app already runs Node, not edge, consistent with `output: "standalone"`.
- **This is exactly the shape the SDK's fetch-native transport, and both `mcp-handler` generations, target.** `WebStandardStreamableHTTPServerTransport`'s own JSDoc explicitly lists Cloudflare Workers/Deno/Bun and Node 18+ as compatible runtimes because it only needs `Request`/`Response`/`ReadableStream`; `createMcpHandler`'s `{ fetch }` shape and `mcp-handler`'s `createMcpHandler` are the identical pattern, and `mcp-handler`'s own README states plainly: *"`createMcpHandler` returns a Web-standard request handler, so the package is not tied to Vercel or any particular framework... Next.js Route Handlers"* is the first framework it lists (`vercel/mcp-handler`, commit `7c8fe0a6d1`). A Next.js Route Handler needs **no adapter at all** for the fetch-native SDK surface — a Node/Express host would need one (`toNodeHandler` from `@modelcontextprotocol/node` in v2, or the `Request`⇄`req/res` bridge in v1's `StreamableHTTPServerTransport`).
- **The "needs a persistent process" framing in the ticket doesn't actually apply to Hyllan's shape.** The constraint that shows up repeatedly in the SDK's and `mcp-handler`'s own docs — needing `Fluid compute`/`maxDuration` tuning, or Redis for cross-invocation session state — is specific to **serverless function execution models** (Vercel's default Lambda-style functions, which cold-start per invocation and don't share memory across them). Hyllan's Route Handler runs inside `next start`, a single long-lived Node HTTP server process per container, not a serverless function — so:
  - There is no default per-request execution-time cap analogous to a serverless function's `maxDuration` to configure (Next.js's own self-hosting doc discusses execution *duration* only in the serverless/edge-adapter context; nothing in `docs/01-app/02-guides/self-hosting.mdx` describes a request timeout for `next start`).
  - **Module-scope state persists across requests** within that one process — the same pattern the SDK's own v2 docs recommend for the stateless factory itself ("create connection pools and caches once at module scope and close over them," `docs/serving/http.md`). A stateful v1-style session `Map<string, transport>` declared at module scope in `app/api/mcp/route.ts` would behave, in Hyllan's single-instance deployment, exactly like the SDK's own Express recipe (`docs/serving/sessions-state-scaling.md`'s `sessions_routing` example) — because it's the same one-Node-process model Express runs in. The complications the SDK's docs describe (external `EventStore`, session-affinity routing) are specifically about **multiple app instances**, which only becomes relevant if/when Hyllan's `app` service is ever scaled to more than one replica — a scenario `docs/research/deployment-architecture.md` already flags as a "later scaling" concern, not today's shape.
- **Streaming through the self-hosted stack needs the reverse proxy configured not to buffer.** Next.js's self-hosting doc is explicit: *"The Next.js App Router supports streaming responses when self-hosting. If you are using nginx or a similar proxy, you will need to configure it to disable buffering to enable streaming ... by setting `X-Accel-Buffering` to `no`"* (`docs/01-app/02-guides/self-hosting.mdx`, "Streaming and Suspense"). The SDK's own transport already sends that header on every SSE response it opens (`webStandardStreamableHttp.ts`: `'X-Accel-Buffering': 'no'` on every SSE `Response`'s headers) and the 2026-07-28 spec itself recommends it (*"servers **SHOULD** include the `X-Accel-Buffering: no` header"*). Whether Hyllan's specific Caddy config needs anything analogous configured on its side was **not researched here** — Caddy is outside this ticket's primary-source scope (MCP SDK/spec + Next.js only) and wasn't covered by any of the sources cited above; flagging it as an open item rather than asserting an unverified answer.

**Bottom line for section 2:** at the HTTP-mechanics level — request/response shape, streaming support, runtime — a Next.js App Router Route Handler is a documented, directly-compatible host for the SDK's fetch-native Streamable HTTP surface, in both SDK generations, with zero adapter code needed. The parts of the ecosystem's documentation that talk about needing a "persistent process" or external state store are about surviving **serverless/multi-instance** execution, not about Route Handlers as a mechanism — and Hyllan's actual deployment (`output: "standalone"`, one Node process behind Caddy) is a persistent single process, the same execution shape the SDK's own stateful/Express examples already assume.

---

## 3. How does bearer-token/OAuth validation plug into the transport?

Consistent across both SDK generations: **the SDK never issues tokens and never validates transport-level auth itself** — it is purely an OAuth *resource server* helper. The host app supplies token verification; the SDK supplies the challenge/response shaping around it.

**v1.30.0** (`src/server/auth/` in `modelcontextprotocol/typescript-sdk`, tag `1.30.0`): `bearerAuth.ts` implements `requireBearerAuth`, an Express-shaped middleware built from a verifier object (`{ verifyAccessToken }`) you write; `router.ts` (`mcpAuthMetadataRouter`, `getOAuthProtectedResourceMetadataUrl`) serves the RFC 9728 protected-resource-metadata document a `401` challenge points at.

**v2 (alpha)** (`docs/serving/authorization.md`, `modelcontextprotocol/typescript-sdk` `main`, commit `3e90449fd5`) makes the same shape available for a web-standard `fetch` host directly, no Express needed:

```ts
const gate = requireBearerAuth({ verifier, requiredScopes: ['mcp'] });
const handler = createMcpHandler(buildServer);

export default {
    async fetch(request: Request): Promise<Response> {
        const auth = await gate(request);
        if (auth instanceof Response) return auth;
        return handler.fetch(request, { authInfo: auth });
    }
};
```

Key facts, quoted from that doc:
- *"Your MCP server is an OAuth **resource server**: it verifies access tokens that an authorization server issued, and it never issues them."*
- The one function the host supplies is `verifyAccessToken(token: string): Promise<AuthInfo>` — "Local JWT verification, RFC 7662 introspection, or a call to your identity provider all fit behind it." Throwing `OAuthError(OAuthErrorCode.InvalidToken)` turns into the `401` challenge automatically.
- A missing/malformed/expired token gets `401 invalid_token`; a token missing a required scope gets `403 insufficient_scope`; both carry a `WWW-Authenticate: Bearer` challenge whose `resource_metadata` parameter points at the RFC 9728 metadata document (`oauthMetadataResponse` on web-standard hosts, `mcpAuthMetadataRouter` under Express).
- Verified `AuthInfo` flows through to tool handlers as `ctx.http.authInfo` (`ctx.http` is `undefined` when the same server also serves stdio).
- Per-tool/per-scope enforcement (beyond the whole-endpoint `requiredScopes` gate) is left to the handler itself — the docs show checking `ctx.http?.authInfo?.scopes.includes(...)` inside a tool and returning `isError: true` rather than an HTTP-level rejection, specifically so a model reading the tool result can react to a refusal rather than losing the connection.
- v1's Authorization *Server* helpers (`mcpAuthRouter`, `ProxyOAuthServerProvider` — i.e., code for running your own token issuer) are explicitly frozen/deprecated in v2, moved to `@modelcontextprotocol/server-legacy/auth`, with the docs recommending "a dedicated identity provider for new servers" instead — the SDK's own auth-server-hosting story is being retired in favor of resource-server-only.

**Vercel's `mcp-handler`** wraps the same primitive as `withMcpAuth(handler, verifyToken, { required, requiredScopes, resourceMetadataPath })`, functionally identical shape — host supplies `verifyToken(req, bearerToken) => Promise<AuthInfo | undefined>`, package handles `401`/`403`/challenge construction (`docs/AUTHORIZATION.md`, `vercel/mcp-handler`, commit `7c8fe0a6d1`).

**Bottom line for section 3:** there is real SDK-level middleware/hook support for the *mechanics* of bearer auth (challenge responses, scope checks, RFC 9728 metadata, threading `AuthInfo` into handlers) — but token verification itself (JWT validation, introspection call, session lookup against Hyllan's own auth — see `src/lib/auth.ts` in this repo) is entirely the host app's responsibility, by design, in both SDK generations.

---

## 4. Documented Next.js integrations

- **[`vercel-labs/mcp-for-next.js`](https://github.com/vercel-labs/mcp-for-next.js)** (commit `b87b0e0bf4`) — Vercel's own minimal Next.js MCP template. `app/mcp/route.ts` is exactly:
  ```ts
  import { createMcpHandler } from "mcp-handler";
  const handler = createMcpHandler((server) => { server.registerTool(/* ... */); });
  export { handler as GET, handler as POST };
  ```
  Its README states directly: *"This template uses `mcp-handler` 2 and the MCP TypeScript SDK v2 to add a stateless MCP server to a Next.js App Router application."* It depends on `@modelcontextprotocol/server@^2.0.0` and `mcp-handler@^2.0.0` — i.e., it's already built on the alpha v2 SDK, not the published-stable 1.x line. Its "Notes for running on Vercel" section (Fluid Compute, Node 20+) is Vercel-serverless-specific and doesn't apply to a self-hosted Node deployment like Hyllan's.

- **[`vercel/mcp-handler`](https://github.com/vercel/mcp-handler)** — the adapter package itself, maintained under the `vercel` GitHub org (i.e., by the company behind Next.js, not by the `modelcontextprotocol` org or the SDK maintainers). Two active lines:
  - **2.x** (commit `7c8fe0a6d1`, current) — built on SDK v2 (alpha), stateless-only, no Redis, serves both 2026-07-28 natively and 2025-era clients statelessly.
  - **1.x** (tag `v1.1.0`) — built on the **published-stable** `@modelcontextprotocol/sdk@1.26.0+`, supports Streamable HTTP and the deprecated SSE transport, with optional Redis for SSE resumability across serverless invocations, and route-config options (`basePath`, `maxDuration`) aimed at serverless hosting.
  Its README states plainly that `createMcpHandler` "returns a Web-standard request handler, so the package is not tied to Vercel or any particular framework," and explicitly lists **Next.js Route Handlers** first among supported mounts, alongside Nuxt/Nitro, SvelteKit, and Hono.

- **The official SDK repo itself has no Next.js-specific example.** `examples/` in `modelcontextprotocol/typescript-sdk` (both the `main`/v2 tree and the `1.30.0` tag) includes framework recipes for **Express, Fastify, and Hono** (`docs/serving/express.md`, `fastify.md`, `hono.md` in v2; `honoWebStandardStreamableHttp.ts` in v1) and a generic "web-standard runtimes" guide (`docs/serving/web-standard.md`, covering Cloudflare Workers/Deno/Bun) — but no Next.js recipe or example directory. Next.js support currently comes entirely from Vercel's own `mcp-handler`/`mcp-for-next.js`, not from the MCP project.

- **`vercel/next.js`'s own examples directory** (searched via `docs/` and repo browsing, commit `9e1dc0ebe4`) does not contain an MCP-specific example either — Next.js's own docs and example gallery don't cover MCP; the integration is entirely Vercel-adjacent (`vercel-labs`/`vercel` org) rather than living in the Next.js core project.

**Bottom line for section 4:** the closest thing to an "official" Next.js + MCP TypeScript SDK example is Vercel's own `mcp-handler` package and its `mcp-for-next.js` template — both real, both currently built on the **unreleased v2 SDK line**, both from the company that makes Next.js (not from the `modelcontextprotocol` org). No example in this space currently targets the published-stable 1.x SDK on Next.js specifically, though `mcp-handler` 1.x exists and documents the same Next.js Route Handler mount pattern for that line.

---

## Sources

**MCP specification** (`modelcontextprotocol/modelcontextprotocol`, commit `4df2d6b6e3`):
- [`docs/specification/2025-06-18/basic/transports.mdx`](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/4df2d6b6e3588efb46e7542d98498e5c630a0a86/docs/specification/2025-06-18/basic/transports.mdx)
- [`docs/specification/2026-07-28/basic/transports/streamable-http.mdx`](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/4df2d6b6e3588efb46e7542d98498e5c630a0a86/docs/specification/2026-07-28/basic/transports/streamable-http.mdx)

**MCP TypeScript SDK — stable (npm `latest`, tag `1.30.0`)** (`modelcontextprotocol/typescript-sdk`, commit `2d889f2b32`):
- [`src/server/streamableHttp.ts`](https://github.com/modelcontextprotocol/typescript-sdk/blob/1.30.0/src/server/streamableHttp.ts)
- [`src/server/webStandardStreamableHttp.ts`](https://github.com/modelcontextprotocol/typescript-sdk/blob/1.30.0/src/server/webStandardStreamableHttp.ts)
- [`src/server/auth/`](https://github.com/modelcontextprotocol/typescript-sdk/tree/1.30.0/src/server/auth) (`middleware/bearerAuth.ts`, `router.ts`)
- [`docs/server.md`](https://github.com/modelcontextprotocol/typescript-sdk/blob/1.30.0/docs/server.md)
- npm registry metadata for `@modelcontextprotocol/sdk` (`dist-tags.latest: 1.30.0`, fetched from `registry.npmjs.org`)

**MCP TypeScript SDK — v2 (alpha, `main` branch)** (`modelcontextprotocol/typescript-sdk`, commit `3e90449fd5`):
- [`docs/serving/http.md`](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md)
- [`docs/serving/web-standard.md`](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/web-standard.md)
- [`docs/serving/sessions-state-scaling.md`](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/sessions-state-scaling.md)
- [`docs/serving/authorization.md`](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/authorization.md)
- [`docs/serving/legacy-clients.md`](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/legacy-clients.md)
- [`docs/protocol-versions.md`](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md)
- [`packages/server/package.json`](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/server/package.json) (`version: 2.0.0`); root [`package.json`](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/package.json) (`version: 2.0.0-alpha.0`)

**Next.js** (`vercel/next.js`, commit `9e1dc0ebe4`):
- [`docs/01-app/03-api-reference/03-file-conventions/route.mdx`](https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/03-file-conventions/route.mdx)
- [`docs/01-app/02-guides/self-hosting.mdx`](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/self-hosting.mdx)

**Vercel's Next.js MCP integration:**
- [`vercel/mcp-handler`](https://github.com/vercel/mcp-handler) — [`README.md`](https://github.com/vercel/mcp-handler/blob/7c8fe0a6d18e2fd112739360ff587cfcd31a1472/README.md) and [`docs/AUTHORIZATION.md`](https://github.com/vercel/mcp-handler/blob/7c8fe0a6d18e2fd112739360ff587cfcd31a1472/docs/AUTHORIZATION.md) (v2.1.1, commit `7c8fe0a6d1`); [`README.md` at tag `v1.1.0`](https://github.com/vercel/mcp-handler/blob/v1.1.0/README.md) (stable-SDK-compatible line)
- [`vercel-labs/mcp-for-next.js`](https://github.com/vercel-labs/mcp-for-next.js) (commit `b87b0e0bf4`) — [`README.md`](https://github.com/vercel-labs/mcp-for-next.js/blob/b87b0e0bf4eabfbd854f5f71042522c9d69eba86/README.md), [`app/mcp/route.ts`](https://github.com/vercel-labs/mcp-for-next.js/blob/b87b0e0bf4eabfbd854f5f71042522c9d69eba86/app/mcp/route.ts), [`package.json`](https://github.com/vercel-labs/mcp-for-next.js/blob/b87b0e0bf4eabfbd854f5f71042522c9d69eba86/package.json)

**This repo (context only):**
- `README.md`, "Production deployment"
- `docs/research/deployment-architecture.md`
