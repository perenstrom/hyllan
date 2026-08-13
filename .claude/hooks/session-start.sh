#!/bin/bash
set -euo pipefail

# Only relevant in Claude Code on the web / remote sessions, and only where
# the docker CLI/daemon are actually installed in the environment image.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if ! command -v dockerd >/dev/null 2>&1; then
  exit 0
fi

# Idempotent: skip if a daemon is already up and answering.
if [ -S /var/run/docker.sock ] && docker info >/dev/null 2>&1; then
  exit 0
fi

nohup dockerd >/var/log/dockerd.log 2>&1 &
disown

for _ in $(seq 1 30); do
  if [ -S /var/run/docker.sock ] && docker info >/dev/null 2>&1; then
    echo "Docker daemon ready."
    exit 0
  fi
  sleep 1
done

echo "Warning: docker daemon did not become ready within 30s; see /var/log/dockerd.log" >&2
exit 0
