# Research: Self-hosted deployment architecture

**Ticket:** [PER-215 — Specify self-hosted deployment architecture](https://linear.app/per-enstrom/issue/PER-215/specify-self-hosted-deployment-architecture) (child of PER-212, "Hyllan — pantry inventory MVP spec")

**Scope:** Self-hosting on Docker/VPS is a locked decision. This note researches the *shape* of that deployment: container layout, reverse proxy/TLS, Postgres backup strategy, and VPS sizing, against primary sources only.

**Note on location:** this repo has no established convention for research notes yet. `docs/research/` is a new directory introduced by this ticket as a sensible home for future research write-ups; flagging that here rather than assuming prior art.

---

## 1. Recommendations (summary)

| Question | Recommendation |
|---|---|
| Container layout | One Docker Compose stack, three services: `app` (Next.js, `output: "standalone"`), `db` (official `postgres` image), `proxy` (Caddy). Not split into separate stacks/orchestrators at this scale. |
| Reverse proxy + TLS | **Caddy**, for automatic HTTPS with zero manual ACME/certbot config. |
| Postgres backups | Scheduled `pg_dump` (custom format, `-Fc`) per database + `pg_dumpall --globals-only` for roles, shipped off-server. WAL archiving/PITR is explicitly more than this app's scale needs at MVP. |
| VPS sizing | A single 2 vCPU / 4 GB RAM / 40 GB SSD VPS (e.g. Hetzner CX22 class) is sufficient for the app + Postgres + proxy at "modest number of households" scale, with headroom to vertically resize. |

Detail and sourcing for each below.

---

## 2. Container layout

**Recommendation:** a single Docker Compose stack with three services — `app` (Next.js), `db` (Postgres), `proxy` (Caddy) — defined in one `compose.yaml`, running on one VPS. No separate orchestration platform (Kubernetes, Nomad, etc.) and no splitting the app/db/proxy across independently-deployed stacks.

**Why this is the standard pattern:**

- Docker's own containerization guide for Next.js builds the workflow around a `compose.yaml` file as the deployment artifact — Compose is the first-party recommended way to run a containerized Next.js app, not an afterthought. ([Docker: Containerize a Next.js application](https://docs.docker.com/guides/nextjs/))
- Docker Compose's official getting-started walkthrough demonstrates exactly this shape: an app service (`web`) plus a backing service (`redis`, standing in for any datastore) declared as separate services in the same Compose file, sharing a default network so services address each other by service name. Compose's own `include` feature lets a project *later* split service definitions across multiple files while remaining "part of the same application" — the docs frame this as an optional scaling step, not the starting point. ([Docker Compose: Try Compose](https://docs.docker.com/compose/gettingstarted/))
- Next.js's own deployment docs list Docker containers as a fully-supported deployment target alongside a plain Node.js server, and explicitly point to Docker's guide for containerization best practice rather than prescribing a different shape. ([Next.js: Deploying](https://nextjs.org/docs/app/getting-started/deploying))
- Next.js's self-hosting guide recommends the standalone output build (`output: "standalone"`) as the deployable artifact — this is what the Docker examples use to produce a minimal production image. ([Next.js: Self-Hosting](https://nextjs.org/docs/app/guides/self-hosting))

**Why not split further at this scale:** Compose's own docs treat multi-file/multi-stack splitting as a scaling mechanism for when a project's services grow past what's comfortable in one file — nothing in Docker's or Next.js's docs suggests splitting is necessary or standard for a small app + single database + proxy. A single household-scale pantry app with one Postgres instance has no operational need (independent scaling, independent deploy cadence, team ownership boundaries) that would justify the added complexity of separate stacks.

**Implication for the app:** Next.js's self-hosting guide flags several things relevant to *any* multi-container topology (even a single instance, worth knowing for later scaling) — build cache/ID consistency across containers, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` needing to be stable across instances, and in-memory ISR cache being per-instance/on-disk by default. None of these block a single-instance deployment; they become relevant only if the app service is ever scaled to multiple replicas. ([Next.js: Self-Hosting — Multi-Server Deployments](https://nextjs.org/docs/app/guides/self-hosting))

---

## 3. Reverse proxy + TLS

**Recommendation:** Caddy, run as its own container in the same Compose stack, in front of the Next.js `app` service.

**Why:**

- Next.js's own self-hosting docs explicitly recommend *not* exposing the Next.js server directly to the internet: "it's recommended to use a reverse proxy (like nginx) in front of your Next.js server rather than exposing it directly." A proxy absorbs malformed requests, slow-connection attacks, payload limits, and rate limiting, freeing the app server for rendering. ([Next.js: Self-Hosting — Reverse Proxy](https://nextjs.org/docs/app/guides/self-hosting))
- Caddy's own docs describe automatic HTTPS as a first-class, default feature — "Caddy was the first web server to use HTTPS automatically and by default." For a public domain, Caddy obtains and renews certificates from Let's Encrypt/ZeroSSL via ACME automatically, with no separate certbot process, renewal cron job, or manual nginx TLS directives required. Requirements are just: DNS pointed at the server, ports 80/443 reachable, and a persistent, writable data directory for Caddy to store certs in. Caddy's docs put it plainly: "You won't have to do anything else about it. It just works!" ([Caddy: Automatic HTTPS](https://caddyserver.com/docs/automatic-https))
- Caddy's own Docker Compose guidance shows the exact shape needed here: a `caddy` service binding ports 80/443 (+443/udp for HTTP/3), with `caddy_data` and `caddy_config` named volumes to persist certificates and config across container restarts, and a bind-mounted Caddyfile. It also flags a networking gotcha relevant to this stack: inside the Caddy container, "localhost means 'this container', not 'this machine'" — the Caddyfile must `reverse_proxy` to the Next.js service by its Compose service name (e.g. `app:3000`), not `localhost`. ([Caddy: Running Caddy — Docker Compose](https://caddyserver.com/docs/running))
- This compares favorably at this scale to the two common alternatives:
  - **nginx + certbot** requires a separate certbot container/cron process to obtain and renew certs and inject them into nginx config — nginx itself has no built-in ACME client. Next.js's own docs use nginx as *the* example reverse proxy but only for request handling, not TLS automation, and separately flag that nginx must have `X-Accel-Buffering: no` configured to avoid breaking Next.js's streaming responses (App Router streaming/Suspense, Partial Prerendering) — an extra piece of required nginx-specific tuning that Caddy does not need. ([Next.js: Self-Hosting — Streaming and Suspense](https://nextjs.org/docs/app/guides/self-hosting))
  - **Traefik** also automates ACME certificates, but does so via explicit certificate-resolver, entrypoint, and provider configuration rather than Caddy's zero-config default — a reasonable choice for larger/dynamic multi-service fleets, but more moving parts than a single-app-service VPS deployment needs.

**Net:** Caddy gets both jobs (proxy + TLS) done with the least configuration surface, which matches the "small self-hosted app" framing of this ticket.

---

## 4. Postgres backup strategy

**Recommendation:** scheduled logical backups — `pg_dump` (custom format, `-Fc`) of the application database, plus `pg_dumpall --globals-only` for roles — run on a cron schedule from a sidecar/cron job, with the resulting files shipped to off-server storage. Do **not** set up WAL archiving/continuous archiving (PITR) for MVP; it is real overkill for this scale and revisit if/when RPO requirements tighten.

**Why, per PostgreSQL's own docs (Chapter 25, "Backup and Restore"):**

- PostgreSQL's docs describe three approaches: SQL dump (`pg_dump`/`pg_dumpall`), file-system-level backup, and continuous archiving/point-in-time recovery (WAL archiving + base backups). ([PostgreSQL: Backup and Restore](https://www.postgresql.org/docs/current/backup.html))
- `pg_dump` is explicitly designed to be safe against a live database: "pg_dump is a utility for exporting a PostgreSQL database. It makes consistent exports even if the database is being used concurrently. pg_dump does not block other users accessing the database (readers or writers)." ([PostgreSQL: pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html))
- Custom format (`-Fc`) is the right output format for this use case per the docs: it's compressed by default, restorable selectively via `pg_restore`, and (along with directory format) is the more flexible/production-oriented option compared to plain SQL text. ([PostgreSQL: pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html))
- `pg_dump` operates one database at a time and — importantly for this app — does **not** capture cluster-wide objects: "pg_dump dumps only a single database at a time, and it does not dump information about roles or tablespaces (because those are cluster-wide rather than per-database)." Since this is a real multi-tenant app (all households in one database, no per-tenant DB), a single `pg_dump` of the app database is sufficient for the data itself, but role/grant definitions need `pg_dumpall --globals-only` alongside it to have a complete restore path. ([PostgreSQL: pg_dumpall](https://www.postgresql.org/docs/current/app-pg-dumpall.html), [PostgreSQL: SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html))
- The docs also carry an explicit caution against relying on `pg_dump` alone at larger scale: "pg_dump is generally not the right choice for taking regular backups of production databases" without further discussion of the alternative (continuous archiving, Chapter 25). ([PostgreSQL: pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)) — read in context, this is about `pg_dump`'s scaling limits (dump time/size grows with the database, and it only gives point-in-time snapshots at the granularity of when you ran it, not continuous recovery) for large/critical production systems, not a blanket objection to using it for a small app. At "modest number of households" scale, dump time and size are non-issues, and the daily-snapshot recovery granularity this gives is an acceptable RPO for an MVP pantry-tracking app (losing at most a day of inventory edits is not a business-critical loss the way it would be for, say, financial records).
- Continuous archiving/WAL-based PITR (Section 25.3) gives finer-grained recovery and is the right tool once uptime/RPO requirements tighten, but it adds real operational surface — WAL archive storage and rotation, base backups (`pg_basebackup`), and a recovery procedure that must be tested — that is not justified by this app's current scale. Flag it as the natural next step if/when the product needs tighter recovery guarantees.

**Practical shape:** a small script (or a lightweight backup sidecar container, e.g. one running `pg_dump` on a cron schedule against the `db` service over the Compose network) writes a `.dump` file per day, retains N days locally, and pushes off the VPS (object storage or similar) so a VPS-level disaster doesn't take backups with it. This is an operational detail for implementation, not something the primary sources prescribe a tool for — the docs describe the primitives (`pg_dump`, `pg_dumpall -g`), not a scheduler.

---

## 5. VPS sizing

**Recommendation:** one small VPS — 2 vCPU / 4 GB RAM / 40 GB SSD class — is enough to run all three containers (Next.js, Postgres, Caddy) for an MVP with a modest number of households, with straightforward vertical resize as a growth path.

**Reasoning:**

- This is a CRUD-shaped pantry-inventory app (households, items, quantities) — not compute- or IO-heavy. The Next.js process, Postgres, and Caddy are all lightweight at rest; the constraint at this scale is "does it run reliably," not "does it have throughput headroom."
- For concrete sizing reference points (primary sources — each provider's own product/pricing page):
  - **Hetzner Cloud CX22**: 2 vCPU (shared), 4 GB RAM, 40 GB SSD, 20 TB traffic, €3.79/month. Hetzner's own description of this tier: "ideal for development and testing environments, blogs, forums, CMS, small databases, and VPN servers" — a good match for this app's profile. ([Hetzner: New CX plans](https://www.hetzner.com/pressroom/new-cx-plans/))
  - **DigitalOcean Basic Droplet**, 1 vCPU / 1 GB RAM / 25 GB SSD tier, $6/month, up to 2 vCPU / 2 GB RAM / 60 GB SSD at $18/month. DigitalOcean's own docs position Basic Droplets as best for "bursty applications that can handle variable levels of CPU" rather than sustained load. ([DigitalOcean: Droplet pricing](https://www.digitalocean.com/pricing/droplets))
- Given Postgres and Next.js run alongside each other on the same box, err toward the Hetzner CX22-class tier (4 GB RAM) over the cheapest 1 GB DigitalOcean tier — running app + DB + proxy on 1 GB RAM leaves very little headroom for Postgres's shared buffers and OS page cache, and Next.js production builds are not trivially small in memory. 4 GB gives comfortable headroom for all three services plus backup jobs running periodically, without materially changing monthly cost (single-digit euros/dollars either way).
- Growth path: vertical resize (bump vCPU/RAM/disk on the same provider) is the natural next step if usage grows past this tier, rather than re-architecting into separate app/DB hosts — consistent with the container-layout recommendation above of keeping this as one stack until there's a concrete reason not to.

**Caveat:** sizing guidance here is necessarily judgment-based rather than a documented "Postgres + Next.js needs X RAM" rule — neither PostgreSQL's nor Next.js's official docs publish minimum hardware sizing for a workload like this. The concrete numbers cited are provider spec/pricing pages (primary sources for their own products), combined with reasoning about this app's (light) workload shape.

---

## Sources

- [Next.js: Deploying](https://nextjs.org/docs/app/getting-started/deploying)
- [Next.js: Self-Hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Docker: Containerize a Next.js application](https://docs.docker.com/guides/nextjs/)
- [Docker Compose: Try Compose (multi-service getting started)](https://docs.docker.com/compose/gettingstarted/)
- [Caddy: Automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Caddy: Running Caddy (Docker Compose)](https://caddyserver.com/docs/running)
- [PostgreSQL: Backup and Restore (ch. 25 overview)](https://www.postgresql.org/docs/current/backup.html)
- [PostgreSQL: SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html)
- [PostgreSQL: pg_dump reference](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL: pg_dumpall reference](https://www.postgresql.org/docs/current/app-pg-dumpall.html)
- [Docker Hub: postgres official image](https://hub.docker.com/_/postgres)
- [Hetzner: New CX plans (pressroom)](https://www.hetzner.com/pressroom/new-cx-plans/)
- [DigitalOcean: Droplet pricing](https://www.digitalocean.com/pricing/droplets)
