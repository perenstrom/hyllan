# Bakes 01-auth-schema.sh into the image instead of bind-mounting
# ../postgres-init at runtime — a host bind-mount's source path is only as
# reliable as wherever the compose file happens to be checked out on the
# deployment host, which self-hosting platforms (e.g. Coolify) don't always
# keep at the path their own rendered compose file assumes.
FROM postgres:17-alpine
COPY postgres-init/ /docker-entrypoint-initdb.d/
