#!/usr/bin/env bash
set -euo pipefail

# Transport: `gh webhook forward` creates a temporary webhook on the repo,
# tunnels deliveries to the local forge, and removes the webhook on exit.
# The websocket can drop, so we reconnect automatically.

cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a

REPO="${FORGE_REPO:-$(node -e 'process.stdout.write(require("./config").load().repo||"")')}"
EVENTS="${FORGE_EVENTS:-$(node -e 'process.stdout.write((require("./config").load().events||[]).join(","))')}"

: "${REPO:?set FORGE_REPO in .env or repo: in forge.yml (OWNER/REPO)}"
: "${EVENTS:?set events: in forge.yml (or FORGE_EVENTS)}"

while true; do
  echo "[forward] $REPO [$EVENTS] -> http://127.0.0.1:${FORGE_PORT:-3000}/"
  gh webhook forward \
    --repo="$REPO" \
    --events="$EVENTS" \
    --url="http://127.0.0.1:${FORGE_PORT:-3000}/" \
    --secret="${FORGE_SECRET:-}" || true
  echo "[forward] disconnected; reconnecting in ${FORGE_RECONNECT:-5}s (Ctrl-C to stop)"
  sleep "${FORGE_RECONNECT:-5}"
done
