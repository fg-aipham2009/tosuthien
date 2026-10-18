#!/usr/bin/env bash
# Create isolated Postgres database "cbeta" (same instance as tosuthien) + apply schema.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCHEMA="$ROOT/docker/postgres/cbeta/01-schema.sql"
MODE="${1:-local}" # local | vps

if [[ "$MODE" == "vps" ]]; then
  ssh tosuthien-vps2 "cd /opt/tosu-thien && docker compose exec -T db psql -U tosuthien -d postgres -v ON_ERROR_STOP=1 -c \"SELECT 1 FROM pg_database WHERE datname='cbeta'\" | grep -q 1 || docker compose exec -T db psql -U tosuthien -d postgres -v ON_ERROR_STOP=1 -c \"CREATE DATABASE cbeta OWNER tosuthien;\""
  ssh tosuthien-vps2 "cd /opt/tosu-thien && docker compose exec -T db psql -U tosuthien -d cbeta -v ON_ERROR_STOP=1" < "$SCHEMA"
  ssh tosuthien-vps2 "cd /opt/tosu-thien && docker compose exec -T db psql -U tosuthien -d cbeta -c '\\dt' -c \"SELECT code, name_vi FROM collections ORDER BY sort_order;\""
else
  # local docker
  cd "$ROOT"
  docker compose exec -T db psql -U tosuthien -d postgres -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_database WHERE datname='cbeta'" | grep -q 1 \
    || docker compose exec -T db psql -U tosuthien -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE cbeta OWNER tosuthien;"
  docker compose exec -T db psql -U tosuthien -d cbeta -v ON_ERROR_STOP=1 < "$SCHEMA"
  docker compose exec -T db psql -U tosuthien -d cbeta -c '\dt' -c "SELECT code, name_vi FROM collections ORDER BY sort_order;"
fi
echo "OK CBETA_DATABASE_URL=postgresql://tosuthien:***@db:5432/cbeta"
