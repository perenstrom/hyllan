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

## Database

- `npm run db:generate` — diff `src/db/schema/app.ts` against the existing migrations and write a new one under `drizzle/`
- `npm run db:migrate` — apply pending migrations to `DATABASE_URL`

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

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript, no emit
- `npm test` — run tests once (Vitest)
- `npm run test:watch` — Vitest in watch mode
- `npm run format` / `npm run format:check` — Prettier
