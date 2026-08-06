# hyllan

Pantry management web app.

## Development

Requires Node 24 (see `.nvmrc`) and Docker.

1. Copy the env file and start Postgres + self-hosted Supabase Auth (GoTrue):

   ```bash
   cp .env.example .env
   docker compose up -d
   ```

2. Install dependencies and apply the Drizzle migrations:

   ```bash
   npm install
   npm run db:migrate
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000). [http://localhost:3000/api/health](http://localhost:3000/api/health) reports `{"status":"healthy"}` once it can query Postgres, `{"status":"unhealthy"}` (503) otherwise.

GoTrue runs standalone (not the full Supabase bundle) against the same Postgres instance, under its own `supabase_auth_admin` role — see `docker/postgres-init/`. Its `auth.users` table is created and migrated by GoTrue itself; Hyllan's own schema only references it via foreign key (`src/db/schema/auth.ts`) and never writes to it.

The app talks to GoTrue via `@supabase/ssr` (`src/lib/supabase/`), with `NEXT_PUBLIC_SUPABASE_URL` pointing at the app's own origin rather than GoTrue directly: since standalone GoTrue has no Kong in front of it, `next.config.ts` rewrites `/auth/v1/*` to `GOTRUE_API_EXTERNAL_URL`, playing Kong's usual path-prefixing role. `src/proxy.ts` refreshes the session (rotating GoTrue's refresh token) on every request — required because Server Components can only read cookies, not set them.

## Database

- `npm run db:generate` — diff `src/db/schema/app.ts` against the existing migrations and write a new one under `drizzle/`
- `npm run db:migrate` — apply pending migrations to `DATABASE_URL`
- `npm run db:seed` — dev-only: creates a `dev@example.com` / `development` account (via GoTrue's `/signup`, same as a real signup) with a household and a handful of pantry items, so there's something to look at right after `npm run dev`. Safe to re-run — it skips item seeding if the account already has items.

## Production deployment

Single-VPS, single Docker Compose stack — no Kubernetes, no split stacks, no
WAL archiving/point-in-time recovery. See
`docs/research/deployment-architecture.md` for the reasoning behind this
shape.

**Sizing:** a 2 vCPU / 4 GB RAM / 40 GB SSD-class VPS (e.g. Hetzner CX22) is
enough to run the app, Postgres, GoTrue, Caddy, and the backup job
comfortably, with vertical resize as the growth path.

**Services** (`compose.yaml`, gated behind the `production` Compose profile
so plain `docker compose up -d` for local dev is unaffected):

- `app` — the Next.js production build (`output: "standalone"`), built from
  the repo's `Dockerfile`
- `db` / `auth` — the same Postgres + GoTrue services local dev uses
- `proxy` — Caddy, reverse-proxying `DOMAIN` to `app` and `AUTH_DOMAIN` to
  `auth`, obtaining/renewing HTTPS certificates automatically (`Caddyfile`)
- `backup` — a small cron container (`docker/backup/`) that runs `pg_dump`
  (custom format) of the app database plus `pg_dumpall --globals-only` for
  roles, daily at 03:00, and ships both off-server via `rclone` if
  `BACKUP_RCLONE_REMOTE` is configured

Each service has a Compose `healthcheck`; `app` only starts serving once `db`
and `auth` report healthy (`depends_on: condition: service_healthy`), and
`proxy` waits on `app` and `auth` the same way.

**Deploying:**

```bash
cp .env.example .env
# Edit .env: DOMAIN, AUTH_DOMAIN, GOTRUE_SITE_URL, GOTRUE_API_EXTERNAL_URL,
# GOTRUE_JWT_SECRET, POSTGRES_PASSWORD, and (for off-server backups)
# BACKUP_RCLONE_REMOTE + RCLONE_CONFIG_<REMOTE>_* — see .env.example.
docker compose --profile production up -d --build
npm run db:migrate
```

DNS for both `DOMAIN` and `AUTH_DOMAIN` must already point at the VPS before
starting `proxy`, so Caddy's ACME challenge can succeed.

**Restoring a backup:**

```bash
# Roles/grants first, then the app database itself
psql -h <host> -U postgres -f globals-<timestamp>.sql
pg_restore -h <host> -U postgres -d hyllan --clean --if-exists hyllan-<timestamp>.dump
```

Deployment config here is reviewed manually rather than covered by automated
tests, per the project's testing strategy
(`docs/research/testing-observability-strategy.md`).

## Observability

- **Application logs** — [Pino](https://github.com/pinojs/pino) (`src/lib/logger.ts`),
  JSON to stdout, captured by Docker's `json-file` log driver. `LOG_LEVEL`
  (default `info`) controls verbosity.
- **Postgres logs** — left at the `stderr` default (so `docker compose logs
  db` shows them like every other service), with `log_min_duration_statement`
  and `log_lock_waits` turned on (`compose.yaml`'s `db.command`) for
  slow-query and lock-contention visibility.
- **Caddy access logs** — left at Caddy's own default (structured JSON to
  stderr when not attached to a terminal, i.e. under Docker) — no extra
  config.
- **Docker log growth** — every service in `compose.yaml` sets a `max-size`/
  `max-file` `logging` block (`x-default-logging`), since the default
  `json-file` driver doesn't rotate on its own.
- **Error tracking** — unhandled errors are reported to a self-hosted
  [GlitchTip](https://glitchtip.com) instance (a lighter, Sentry-API-
  compatible alternative to self-hosted Sentry — see
  `docs/research/testing-observability-strategy.md` §6) via the standard
  `@sentry/nextjs` SDK and Next.js's `onRequestError` instrumentation hook
  (`src/instrumentation.ts`, `src/instrumentation-client.ts`,
  `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`). Deploying
  GlitchTip itself is the operator's concern — set `GLITCHTIP_DSN` (server)
  and `NEXT_PUBLIC_GLITCHTIP_DSN` (client, must also be passed as a Docker
  build arg — see `Dockerfile`/`compose.yaml`'s `app.build.args`) to your
  GlitchTip project's DSN once it's deployed. Both unset (the `.env.example`
  default) runs with error reporting disabled — `Sentry.init()` with no DSN
  is a documented no-op. Source-map upload is intentionally disabled
  (`next.config.ts`'s `sourcemaps.disable`) since it targets Sentry's own
  release API, which GlitchTip doesn't implement.
- **Uptime monitoring** — once GlitchTip is deployed, configure its built-in
  uptime/heartbeat monitor against the deployed app's `/api/health` endpoint
  (`https://$DOMAIN/api/health`) rather than standing up a separate uptime
  tool — see GlitchTip's own docs for adding a check.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

- **type** — one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
  `build`, `ci`, `chore`, `revert`.
- **scope** — optional, the area touched (e.g. `feat(auth): ...`).
- **description** — imperative, lower case, no trailing period.
- **Linear ticket** — Linear's GitHub integration auto-completes an issue
  whenever a PR whose branch name or commit references that issue's ID gets
  merged, regardless of whether that PR actually implements the fix. So the
  bare `(PER-XXX)` suffix, and that ticket's Linear-suggested branch name,
  are reserved for the commit/PR that actually finishes the work:
  - **Closing commit** (implements/finishes the ticket) — use the ticket's
    Linear-suggested branch name and append its ID in parentheses, e.g.
    `fix(pantry): correct low-stock threshold check (PER-251)`.
  - **Non-closing commit** (docs, ADRs, research, triage notes that relate
    to a ticket without finishing it) — do not use that ticket's
    Linear-suggested branch name. Reference the ticket in the commit body
    as `Refs PER-XXX` instead of the parenthetical suffix, so merging it
    doesn't auto-complete the issue.
- **Breaking changes** — mark with `!` after the type/scope
  (`feat(api)!: ...`) and explain in a `BREAKING CHANGE:` footer.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript, no emit
- `npm test` — run unit/integration tests once (Vitest, including PGlite-backed integration tests)
- `npm run test:watch` — Vitest in watch mode
- `npm run test:e2e` — Playwright E2E tests; builds and runs a production server, so the Docker stack must be up and migrations applied first
- `npm run format` / `npm run format:check` — Prettier
