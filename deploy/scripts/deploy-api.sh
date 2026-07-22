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

echo "==> docker compose up api (local build, clear API_IMAGE)"
ssh "$VPS_HOST" bash -s <<REMOTE
set -euo pipefail
cd "$VPS_REPO"
# Prefer local build over a stale CI API_IMAGE in the shell env.
unset API_IMAGE || true
export API_PULL_POLICY=missing
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
