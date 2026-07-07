#!/usr/bin/env bash
# Restart API with latest build. Requires embed_server on host :7997 for hybrid RAG.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! curl -sf http://127.0.0.1:7997/health >/dev/null 2>&1; then
  echo "Starting embed server on :7997..."
  nohup python3 scripts/embed_server.py >> /tmp/tosu-embed.log 2>&1 &
  for i in $(seq 1 30); do
    curl -sf http://127.0.0.1:7997/health >/dev/null 2>&1 && break
    sleep 1
  done
fi

docker compose build api
docker compose up -d --no-deps --force-recreate api
echo "API: http://localhost:8000/api/health"
