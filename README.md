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

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript, no emit
- `npm test` — run tests once (Vitest)
- `npm run test:watch` — Vitest in watch mode
- `npm run format` / `npm run format:check` — Prettier
