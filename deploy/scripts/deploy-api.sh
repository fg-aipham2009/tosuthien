#!/usr/bin/env bash
# Sync NestJS API sources to VPS and force-recreate the api container.
# Usage: VPS_HOST=tosuthien-vps ./deploy/scripts/deploy-api.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-tosuthien-vps}"
VPS_REPO="${VPS_REPO:-/opt/tosu-thien}"

echo "==> rsync nestjs/ → $VPS_HOST:$VPS_REPO/nestjs/"
rsync -avz \
  --exclude node_modules \
  --exclude dist \
  --exclude .env \
  "$REPO_ROOT/nestjs/" "$VPS_HOST:$VPS_REPO/nestjs/"

echo "==> sync database migration"
ssh "$VPS_HOST" "mkdir -p '$VPS_REPO/docker/postgres/migrations'"
rsync -avz \
  "$REPO_ROOT/docker/postgres/migrations/013-posts-news-gallery.sql" \
  "$REPO_ROOT/docker/postgres/migrations/014-centers-display-order.sql" \
  "$REPO_ROOT/docker/postgres/migrations/015-admin-users.sql" \
  "$REPO_ROOT/docker/postgres/migrations/018-teachers-classes-announcements.sql" \
  "$REPO_ROOT/docker/postgres/migrations/019-post-images-full-url.sql" \
  "$REPO_ROOT/docker/postgres/migrations/020-posts-announcement-fields.sql" \
  "$REPO_ROOT/docker/postgres/migrations/021-dedupe-post-images.sql" \
  "$REPO_ROOT/docker/postgres/migrations/022-zoom-rooms.sql" \
  "$REPO_ROOT/docker/postgres/migrations/023-link-posts-zoom-rooms.sql" \
  "$REPO_ROOT/docker/postgres/migrations/024-sync-posts-zoom-display.sql" \
          "$REPO_ROOT/docker/postgres/migrations/025-posts-soft-delete.sql" \
  "$REPO_ROOT/docker/postgres/migrations/026-posts-freeform.sql" \
  "$VPS_HOST:$VPS_REPO/docker/postgres/migrations/"

echo "==> docker compose up api (local build, clear API_IMAGE)"
ssh "$VPS_HOST" bash -s <<REMOTE
set -euo pipefail
cd "$VPS_REPO"
# Prefer local build over a stale CI API_IMAGE in the shell env.
unset API_IMAGE || true
export API_PULL_POLICY=missing
echo "==> apply database migrations"
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/013-posts-news-gallery.sql || true
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/014-centers-display-order.sql || true
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/015-admin-users.sql || true
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/018-teachers-classes-announcements.sql || true
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/019-post-images-full-url.sql || true
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/020-posts-announcement-fields.sql || true
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/021-dedupe-post-images.sql || true
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/022-zoom-rooms.sql || true
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/023-link-posts-zoom-rooms.sql || true
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/024-sync-posts-zoom-display.sql || true
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/025-posts-soft-delete.sql || true
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB"' \
  < docker/postgres/migrations/026-posts-freeform.sql
# Drop stuck "Created" / orphaned api containers from prior races.
docker ps -aq --filter name=tosu_api --filter status=created | xargs -r docker rm -f
docker compose up -d --build --force-recreate --remove-orphans api
echo "==> wait healthy"
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  cid=\$(docker compose ps -q api)
  st=\$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "\$cid" 2>/dev/null || echo none)
  echo "  try \$i health=\$st"
  if [[ "\$st" == "healthy" ]]; then
    curl -sf http://127.0.0.1:8000/api/health
    echo
    docker compose ps api
    exit 0
  fi
  # If stuck in Created, start it.
  if [[ "\$st" == "created" ]]; then
    docker start "\$cid" || true
  fi
  sleep 3
done
echo "API health check failed" >&2
docker compose logs --tail=80 api >&2 || true
exit 1
REMOTE

echo ""
echo "OK — API healthy"
echo "Test: curl -sS https://api.tosuthien.net/api/media/categories"
