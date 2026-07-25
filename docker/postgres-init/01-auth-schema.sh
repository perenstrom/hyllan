#!/bin/sh
# GoTrue's own migrations create everything under auth.* themselves, but
# (a) expect the "auth" schema to already exist, and (b) assume they're
# connecting as a role with "auth" on its search_path (unqualified queries
# like `select * from identities` otherwise fail with "relation does not
# exist"). The official Supabase Postgres image sets this up via its own
# init scripts for a dedicated `supabase_auth_admin` role — mirrored here,
# scoped down for a standalone GoTrue instance, and kept separate from the
# app/Drizzle's own Postgres role so the app's search_path is untouched.
# See supabase/auth's hack/init_postgres.sql for the upstream original.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE USER supabase_auth_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION PASSWORD '$GOTRUE_DB_PASSWORD';
  CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
  GRANT CREATE ON DATABASE "$POSTGRES_DB" TO supabase_auth_admin;
  ALTER USER supabase_auth_admin SET search_path = 'auth';
EOSQL
