#!/usr/bin/env bash
# Sync Vue admin (vuejs/) to VPS and rebuild admin container WITHOUT recreating API.
# Usage: VPS_HOST=tosuthien-vps ./deploy/scripts/deploy-admin.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-tosuthien-vps}"
VPS_REPO="${VPS_REPO:-/opt/tosu-thien}"

echo "==> rsync vuejs/ → $VPS_HOST:$VPS_REPO/vuejs/"
rsync -avz \
  --exclude node_modules \
  --exclude dist \
  "$REPO_ROOT/vuejs/" "$VPS_HOST:$VPS_REPO/vuejs/"

echo "==> docker compose build admin (--no-deps so API is not recreated)"
ssh "$VPS_HOST" bash -s <<REMOTE
set -euo pipefail
cd "$VPS_REPO"
docker compose up -d --build --force-recreate --no-deps admin
# Make sure API is still running after prior races.
cid=\$(docker compose ps -q api || true)
if [[ -n "\$cid" ]]; then
  st=\$(docker inspect --format '{{.State.Status}}' "\$cid" 2>/dev/null || echo none)
  if [[ "\$st" != "running" ]]; then
    echo "==> API was \$st — starting"
    docker start "\$cid" || docker compose up -d api
  fi
else
  echo "==> API missing — starting"
  docker compose up -d api
fi
docker compose ps
REMOTE

echo ""
echo "OK — admin deployed. Open https://admin.tosuthien.net"
