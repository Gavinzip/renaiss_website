#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8787}"
NEWS_INTERVAL_MINUTES="${NEWS_INTERVAL_MINUTES:-60}"
NEWS_LANGS="${NEWS_LANGS:-zh-Hant}"
X_SYNC_RUN_ON_STARTUP="${X_SYNC_RUN_ON_STARTUP:-1}"

SYNC_ARGS=()
if [[ "$X_SYNC_RUN_ON_STARTUP" =~ ^(1|true|TRUE|yes|YES|on|ON)$ ]]; then
  SYNC_ARGS+=(--sync-run-on-startup)
fi

exec python3 scripts/ai_intel_server.py \
  --host "$HOST" \
  --port "$PORT" \
  --news-interval-minutes "$NEWS_INTERVAL_MINUTES" \
  --news-langs "$NEWS_LANGS" \
  "${SYNC_ARGS[@]}"
