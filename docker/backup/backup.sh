#!/bin/sh
# Scheduled by crontab (see Dockerfile). Takes a logical backup of the app
# database plus cluster-wide roles, per docs/research/deployment-architecture:
# pg_dump alone omits roles/grants (cluster-wide, not per-database), so
# pg_dumpall --globals-only runs alongside it for a complete restore path.
set -eu

DUMP_DIR=/backups
TIMESTAMP=$(date +%Y%m%d%H%M%S)
APP_DUMP="$DUMP_DIR/hyllan-${TIMESTAMP}.dump"
GLOBALS_DUMP="$DUMP_DIR/globals-${TIMESTAMP}.sql"

mkdir -p "$DUMP_DIR"

echo "[backup] $(date -Iseconds) starting: $APP_DUMP"
pg_dump -Fc -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -f "$APP_DUMP"
pg_dumpall -h "$PGHOST" -U "$PGUSER" --globals-only -f "$GLOBALS_DUMP"
echo "[backup] $(date -Iseconds) dump complete"

if [ -z "${BACKUP_RCLONE_REMOTE:-}" ]; then
  echo "[backup] BACKUP_RCLONE_REMOTE is not set — refusing to leave backups local-only, see README" >&2
  exit 1
fi

echo "[backup] shipping to $BACKUP_RCLONE_REMOTE"
rclone copy "$APP_DUMP" "$BACKUP_RCLONE_REMOTE"
rclone copy "$GLOBALS_DUMP" "$BACKUP_RCLONE_REMOTE"
echo "[backup] shipped"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
find "$DUMP_DIR" -type f -mtime +"$RETENTION_DAYS" -delete

# Healthcheck freshness marker (see compose.yaml) — only touched once the
# dump has actually shipped off-server, so a stuck/failing job (this script
# runs under `set -eu`, so any of the steps above failing exits here first)
# shows up as unhealthy instead of a silently stale local dump directory.
date +%s >"$DUMP_DIR/.last-success"

echo "[backup] $(date -Iseconds) done, local retention ${RETENTION_DAYS}d"
