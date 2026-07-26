# Research: Self-hosting GlitchTip as a Coolify service

**Scope:** Hyllan already reports errors to a self-hosted GlitchTip instance via `@sentry/nextjs` (see `README.md`'s "Observability" section and `.env.example`'s `GLITCHTIP_DSN`/`NEXT_PUBLIC_GLITCHTIP_DSN`), but deploying GlitchTip itself has always been out of this repo's scope — no instance exists yet. The operator is running Hyllan on Coolify (a self-hosted PaaS) on a Hetzner VPS and wants to stand up GlitchTip as a Coolify-hosted service rather than deploy it by hand. This note researches, against primary sources only: whether Coolify has an official/well-supported GlitchTip template; failing that, what GlitchTip's own reference Docker Compose deployment requires; and Coolify-specific gotchas for this particular service. This is pure research — no deployment files are added by this ticket.

---

## 1. Recommendations (summary)

| Question | Finding |
|---|---|
| Official Coolify template? | **Yes.** GlitchTip is an official one-click service template shipped in Coolify's own repository (`templates/compose/glitchtip.yaml`) and listed in Coolify's public service catalog under the "Monitoring" category and its own docs page. Use the built-in template as the starting point rather than hand-rolling a Docker Compose resource from scratch. |
| Reference compose shape (if hand-adapting were needed) | GlitchTip's own reference `docker-compose.sample.yml` defines 5 services: `postgres`, `redis`, `web`, `worker` (Celery + beat, same image as web), `migrate` (one-shot `./bin/run-migrate.sh`, no restart policy). Two named volumes: one for Postgres data, one (`uploads`) shared between `web` and `worker`. |
| Mandatory env vars | Required, per GlitchTip's own install docs: `SECRET_KEY`, `DATABASE_URL`, `GLITCHTIP_DOMAIN` (must include scheme, e.g. `https://glitchtip.example.com`), plus email config (`EMAIL_URL`, or a Mailgun/SendGrid/Anymail-supported API key) and `DEFAULT_FROM_EMAIL`. |
| Key gotchas for a Coolify deployment | `GLITCHTIP_DOMAIN` is GlitchTip's equivalent of a required "public URL" setting (there is no separate `DJANGO_ALLOWED_HOSTS`-style var required by default — `ALLOWED_HOSTS` defaults to `*` and is optional-but-recommended-to-restrict). `SECRET_KEY` is mandatory and Coolify's template auto-generates it via a magic variable. Migrations run via a dedicated one-shot `migrate` service/container, not a manual step, but this exact mechanism has broken Coolify's template twice in the past (both now fixed — see §4). Coolify's template defaults email to `consolemail://` (i.e. emails just get logged, not sent) unless the operator overrides `EMAIL_URL` post-deploy. Creating an admin user is a manual one-time `createsuperuser` command run via Coolify's per-resource web terminal. |

Detail and sourcing for each below.

---

## 2. Is there an official Coolify template for GlitchTip?

**Yes — this is a first-party, official Coolify template, not a community add-on.** It lives directly in Coolify's own GitHub repository at `templates/compose/glitchtip.yaml` on the `v4.x` branch, with the standard template metadata header:

```
# documentation: https://glitchtip.com
# slogan: GlitchTip is a error tracking system.
# category: monitoring
# tags: error, tracking, sentry
# logo: svgs/glitchtip.png
# port: 8000
```
([coollabsio/coolify: `templates/compose/glitchtip.yaml`](https://github.com/coollabsio/coolify/blob/v4.x/templates/compose/glitchtip.yaml))

It also appears in Coolify's own public service documentation:
- Coolify's services overview page lists "Glitchtip — An open-source error tracking tool" under the **Monitoring** category, alongside Grafana, Uptime Kuma, SigNoz, etc. — confirming it's part of the curated, official one-click catalog rather than an unofficial community submission. ([Coolify Docs: Services Overview](https://coolify.io/docs/services/overview))
- GlitchTip has its own dedicated docs page at `coolify.io/docs/services/glitchtip`, though this page itself is intentionally thin (an auto-generated stub common to Coolify's per-service pages): "What is Glitchtip? Track errors, uptime, and performance. An open source reimplementation of Sentry error tracking platform," with links back to the official GlitchTip website and GitHub. ([Coolify Docs: Glitchtip](https://coolify.io/docs/services/glitchtip)) The actual deployment logic lives in the compose template file, not this docs page.

**Recommendation:** use Coolify's "+ New Resource → Services → Glitchtip" one-click flow rather than building a custom "Docker Compose" resource by hand. Coolify's own docs describe the Docker Compose resource type as one where "the Docker Compose file is the single source of truth" and settings must be hand-defined in YAML ([Coolify Docs: Docker Compose](https://coolify.io/docs/knowledge-base/docker/compose)) — the one-click template already does this work and wires in Coolify's credential/URL-generation conventions (see §4), so there's no reason to duplicate it by hand unless the official template proves insufficient.

---

## 3. GlitchTip's own reference Docker Compose deployment

Independent of Coolify, GlitchTip's own marketing/documentation site ships an authoritative `docker-compose.sample.yml`, referenced directly from GlitchTip's install docs ("Copy `compose.sample.yml` to your server as `compose.yml`"). Full contents ([GlitchTip marketing repo: `src/assets/docker-compose.sample.yml`](https://gitlab.com/glitchtip/glitchtip-marketing/-/blob/master/src/assets/docker-compose.sample.yml)):

```yaml
x-environment:
  &default-environment
  DATABASE_URL: postgres://postgres:postgres@postgres:5432/postgres
  SECRET_KEY: change_me_to_something_random # best to run openssl rand -hex 32
  PORT: 8000
  EMAIL_URL: consolemail:// # Example smtp://email:password@smtp_url:port
  GLITCHTIP_DOMAIN: https://app.glitchtip.com # Change this to your domain
  DEFAULT_FROM_EMAIL: email@glitchtip.com # Change this to your email
  CELERY_WORKER_AUTOSCALE: "1,3"
  CELERY_WORKER_MAX_TASKS_PER_CHILD: "10000"

x-depends_on:
  &default-depends_on
  - postgres
  - redis

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_HOST_AUTH_METHOD: "trust"
    restart: unless-stopped
    volumes:
      - pg-data:/var/lib/postgresql/data
  redis:
    image: redis
    restart: unless-stopped
  web:
    image: glitchtip/glitchtip
    depends_on: *default-depends_on
    ports:
      - "8000:8000"
    environment: *default-environment
    restart: unless-stopped
    volumes:
      - uploads:/code/uploads
  worker:
    image: glitchtip/glitchtip
    command: ./bin/run-celery-with-beat.sh
    depends_on: *default-depends_on
    environment: *default-environment
    restart: unless-stopped
    volumes:
      - uploads:/code/uploads
  migrate:
    image: glitchtip/glitchtip
    depends_on: *default-depends_on
    command: ./bin/run-migrate.sh
    environment: *default-environment

volumes:
  pg-data:
  uploads:
```

**Required services**, per this reference file plus GlitchTip's own "System Requirements" section:
- **`postgres`** — GlitchTip's docs state plainly: "GlitchTip requires PostgreSQL (14+)". ([GlitchTip: Install](https://glitchtip.com/documentation/install))
- **`redis`/Valkey** — described as optional: "Valkey (or redis) 7+ is optional... Set to empty string to disable VALKEY and utilize Postgres for task queue, cache, and session storage." ([GlitchTip: Install — Configuration](https://glitchtip.com/documentation/install))
- **`web`** and **`worker`** — GlitchTip's docs describe the deployment as "a single service (or separate web and worker services for scaling)" — the reference compose splits them, with `worker` running `./bin/run-celery-with-beat.sh` (Celery + embedded beat scheduler) on the identical image.
- **`migrate`** — a one-shot container (no `restart` policy set, so it runs `./bin/run-migrate.sh` once and exits) that applies database migrations before/alongside the other services starting.

**Required persistent volumes:** `pg-data` (Postgres data directory, `/var/lib/postgresql/data`) and `uploads` (shared between `web` and `worker` at `/code/uploads`, for sourcemaps/debug symbols/event attachments). GlitchTip's docs confirm: "For local storage with Docker, use a volume. The compose sample includes an `uploads` volume by default." ([GlitchTip: Install — File storage](https://glitchtip.com/documentation/install))

**Sizing:** GlitchTip's own docs state "Recommended system requirements: 512 MB RAM, x86 or arm64 CPU. Minimum system requirements: 256 MB RAM when using all-in-one setup. Careful configuration will allow 128 MB + swap." and that "disk usage varies on usage and event size... a 1 million event per month instance may require 30GB of disk." ([GlitchTip: Install — System Requirements](https://glitchtip.com/documentation/install)) — this is the figure already cited in this repo's `docs/research/testing-observability-strategy.md` when comparing GlitchTip favorably to self-hosted Sentry's 16 GB+ RAM minimum.

---

## 4. Coolify-specific gotchas

### 4.1 Coolify's official template, current state

Fetching the current template directly from Coolify's `v4.x` branch shows it already differs from GlitchTip's own reference compose in ways specific to Coolify's conventions ([coollabsio/coolify: `templates/compose/glitchtip.yaml`](https://github.com/coollabsio/coolify/blob/v4.x/templates/compose/glitchtip.yaml)):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=${SERVICE_USER_POSTGRESQL}
      - POSTGRES_PASSWORD=${SERVICE_PASSWORD_POSTGRESQL}
      - POSTGRES_DB=${POSTGRESQL_DATABASE:-glitchtip}
    volumes:
      - glitchtip-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      ...
  redis:
    image: redis
    healthcheck: ...
  web:
    image: glitchtip/glitchtip:6.0
    depends_on: { postgres: {condition: service_healthy}, redis: {condition: service_healthy} }
    environment:
      - SERVICE_URL_GLITCHTIP_8000
      - DATABASE_URL=postgres://$SERVICE_USER_POSTGRESQL:$SERVICE_PASSWORD_POSTGRESQL@postgres:5432/${POSTGRESQL_DATABASE:-glitchtip}
      - SECRET_KEY=$SERVICE_BASE64_64_ENCRYPTION
      - EMAIL_URL=${EMAIL_URL:-consolemail://}
      - GLITCHTIP_DOMAIN=${SERVICE_URL_GLITCHTIP}
      - DEFAULT_FROM_EMAIL=${DEFAULT_FROM_EMAIL:-test@example.com}
      - CELERY_WORKER_AUTOSCALE=${CELERY_WORKER_AUTOSCALE:-1,3}
      - CELERY_WORKER_MAX_TASKS_PER_CHILD=${CELERY_WORKER_MAX_TASKS_PER_CHILD:-10000}
    volumes:
      - uploads:/code/uploads
  worker:
    image: glitchtip/glitchtip:6.0
    command: ./bin/run-celery-with-beat.sh
    ...(same environment as web)...
  migrate:
    image: glitchtip/glitchtip:6.0
    restart: "no"
    depends_on: { postgres: {condition: service_healthy}, redis: {condition: service_healthy} }
    command: "./manage.py migrate"
    ...(same environment as web, minus the URL var)...
```

Notable Coolify-specific behavior baked into this template:

- **Magic credential/URL variables.** `${SERVICE_USER_POSTGRESQL}`, `${SERVICE_PASSWORD_POSTGRESQL}`, `${SERVICE_BASE64_64_ENCRYPTION}` (used for `SECRET_KEY`), and `SERVICE_URL_GLITCHTIP_8000` are Coolify's own auto-generation syntax: `SERVICE_<TYPE>_<IDENTIFIER>` variables that Coolify computes once and persists — e.g. `SERVICE_PASSWORD_*` gives a random password, `SERVICE_BASE64_64_*` a 64-character random string, `SERVICE_URL_*_<port>` a full URL on the operator's domain proxied to that port. Per Coolify's own docs: "Generated values are reusable across services and persist between deployments." ([Coolify Docs: Environment Variables](https://coolify.io/docs/knowledge-base/environment-variables)) This is what auto-supplies `SECRET_KEY` and the Postgres credentials in the official template — the operator does not need to invent these manually, unlike a fully hand-rolled Docker Compose resource.
- **Only `web` gets a public URL/FQDN**, deliberately — `worker` and `migrate` do not, and this was a fixed bug (see 4.2 below).
- **`GLITCHTIP_DOMAIN=${SERVICE_URL_GLITCHTIP}`** — this wires GlitchTip's required "public URL" env var directly to whatever domain/subdomain Coolify assigns or the operator configures for the `web` service, satisfying the mandatory `GLITCHTIP_DOMAIN` requirement from GlitchTip's own docs automatically.
- **Email defaults to a no-op.** `EMAIL_URL=${EMAIL_URL:-consolemail://}` and `DEFAULT_FROM_EMAIL=${DEFAULT_FROM_EMAIL:-test@example.com}` mean that unless the operator explicitly overrides `EMAIL_URL` with a real SMTP/Mailgun/SendGrid config in Coolify's environment-variable UI post-deploy, GlitchTip will run with email effectively disabled (`consolemail://` just logs emails rather than sending them) — password resets, invite emails, and alert emails would silently go nowhere. Worth setting deliberately at deploy time.
- **Migrations run as a dedicated one-shot service** (`migrate`, `restart: "no"`, running `./manage.py migrate`) rather than automatically inside `web`'s entrypoint — consistent with GlitchTip's own reference compose's `migrate` service, just using `./manage.py migrate` directly instead of the wrapper script `./bin/run-migrate.sh`.

### 4.2 History of breakage in Coolify's template (now fixed, but worth knowing)

The GlitchTip template has broken in Coolify's repo at least twice, both root-caused and fixed via merged PRs against the same file:

1. **Duplicate FQDN generation (fixed 2024-10-09, PR #3799).** The `worker` service previously also declared `SERVICE_FQDN_GLITCHTIP`, generating two public URLs/domains for the stack. Per the PR's own description: "removed duplicate generate FQDN from worker, this had 2 domains generated and proxy woudn't know which container to use[;] now only the main web has a url." ([coollabsio/coolify PR #3799](https://github.com/coollabsio/coolify/pull/3799))
2. **Port mismatch after a GlitchTip image update (fixed 2026-02-16, PR #8249, closing issue #8231).** The template pointed `SERVICE_URL_GLITCHTIP_8080` at port 8080 and used an unpinned `glitchtip/glitchtip` (`latest`) image, but a subsequent GlitchTip release moved the app's internal port to 8000, leaving the template proxying to the wrong port. Symptom reported in the issue: container deploys but the dashboard returns a blank page with "502 Bad Gateway," with Postgres logs showing `relation "uptime_monitor" does not exist` and similar — i.e., the app looked broken/half-migrated when the actual cause was the proxy pointing at a dead port. ([coollabsio/coolify Issue #8231](https://github.com/coollabsio/coolify/issues/8231)) The fix, per the PR's own description: "Pinned version from latest to `6.0` because the latest tag is what broke the template. Changed port number on SERVICE_URL env because the port we had (8080) was no longer used by the application (new port is 8000)." ([coollabsio/coolify PR #8249](https://github.com/coollabsio/coolify/pull/8249))

**Practical implication:** the current template (fetched directly from the `v4.x` branch for this research) already incorporates both fixes — image pinned to `glitchtip/glitchtip:6.0`, port aligned to 8000. But this history shows the template has been fragile across GlitchTip upstream releases (an unpinned `latest` tag broke it once already), so after deploying, verify the dashboard actually loads (not just that containers show "running") and keep an eye on the template/image pin if GlitchTip cuts a new major version later.

### 4.3 No separate `DJANGO_ALLOWED_HOSTS`-equivalent required — but understand what `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` do

GlitchTip's own docs list `ALLOWED_HOSTS` as **optional**, defaulting to `*`: "`ALLOWED_HOSTS` (Default `*`) Comma-separated list of allowed hostnames. Restrict this in production for added security." Coolify's template does not set this explicitly, so it stays wide-open (`*`) unless the operator adds it — a reasonable production hardening step to add manually via Coolify's environment-variable UI once the real domain is known, though not required for the app to function. Separately, GlitchTip's docs flag `CSRF_TRUSTED_ORIGINS` as "Required when using a reverse proxy with a different domain" — since Coolify's own Traefik/proxy sits in front of `web` and `GLITCHTIP_DOMAIN` is wired to the same `SERVICE_URL_GLITCHTIP` value the proxy actually uses, this shouldn't come into play for a standard Coolify deploy, but is worth remembering if a custom domain is later mapped inconsistently between Coolify's proxy config and `GLITCHTIP_DOMAIN`. ([GlitchTip: Install — Configuration](https://glitchtip.com/documentation/install))

### 4.4 Creating the first admin user is a manual, one-time step

Neither GlitchTip's reference compose nor Coolify's template runs `createsuperuser` automatically. GlitchTip's own docs describe this as an explicit manual step: "Django Admin is not necessary for most users. However, if you'd like the ability to fully manage users beyond what our frontend offers, it may be useful. To enable, create a superuser via the Django command `./manage.py createsuperuser`. Then go to `/admin/` and log in." ([GlitchTip: Install — Django Admin](https://glitchtip.com/documentation/install)) In practice for GlitchTip's normal (non-admin) signup flow, the *first* registered user through the web UI becomes the initial org owner — `createsuperuser` is only needed for Django Admin access specifically. Either way, running any one-off management command against the `web` container on Coolify is done via Coolify's built-in per-resource web terminal, which executes commands inside the running container over a WebSocket-backed terminal (`docker exec`-based under the hood) — no SSH-ing to the host or editing the compose file needed. ([Coolify Docs: Terminal](https://coolify.io/docs/knowledge-base/internal/terminal))

### 4.5 If ever hand-adapting instead of using the template: one-shot containers and health checks

Not needed here since the official template already exists and already handles this (its `migrate` service has no `healthcheck` block, so Coolify doesn't misjudge its "exited after success" state as a failure) — but worth recording for completeness: Coolify's Docker Compose docs note that Coolify monitors all services for health by default, and one-time/init containers that intentionally exit should be marked to skip this: "you can 'exclude' specific services (useful for one-time migrations) using `exclude_from_hc: true`." ([Coolify Docs: Docker Compose](https://coolify.io/docs/knowledge-base/docker/compose)) Relevant only if this were ever rebuilt by hand as a custom Docker Compose resource rather than via the one-click template.

---

## Sources

- [Coolify Docs: Services Overview](https://coolify.io/docs/services/overview)
- [Coolify Docs: Glitchtip (service page)](https://coolify.io/docs/services/glitchtip)
- [Coolify Docs: Docker Compose (custom resource type)](https://coolify.io/docs/knowledge-base/docker/compose)
- [Coolify Docs: Environment Variables (magic `SERVICE_*` variables)](https://coolify.io/docs/knowledge-base/environment-variables)
- [Coolify Docs: Terminal](https://coolify.io/docs/knowledge-base/internal/terminal)
- [coollabsio/coolify: `templates/compose/glitchtip.yaml` (v4.x branch, current template)](https://github.com/coollabsio/coolify/blob/v4.x/templates/compose/glitchtip.yaml)
- [coollabsio/coolify PR #3799 — "fix glitchtip template" (duplicate FQDN fix)](https://github.com/coollabsio/coolify/pull/3799)
- [coollabsio/coolify Issue #8231 — "GlitchTip Template Don't work" (port mismatch bug report)](https://github.com/coollabsio/coolify/issues/8231)
- [coollabsio/coolify PR #8249 — "fix(service): glitchtip webdashboard doesn't load" (port/version pin fix)](https://github.com/coollabsio/coolify/pull/8249)
- [GlitchTip: Install documentation (system requirements, Docker Compose instructions, full Configuration/env var reference, Django Admin)](https://glitchtip.com/documentation/install)
- [GlitchTip marketing repo: `src/assets/docker-compose.sample.yml` (official reference compose file)](https://gitlab.com/glitchtip/glitchtip-marketing/-/blob/master/src/assets/docker-compose.sample.yml)
- [GlitchTip meta repo: `README.md` (DigitalOcean/Heroku deploy notes, links to backend/frontend/docs)](https://gitlab.com/glitchtip/glitchtip)

---

**Ticket:** [PER-242 — Self-hosting GlitchTip as a Coolify service](https://linear.app/per-enstrom/issue/PER-242)
