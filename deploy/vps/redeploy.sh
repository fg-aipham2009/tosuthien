#!/usr/bin/env bash
# Pull latest code and restart Docker stack on VPS.
set -euo pipefail

REPO="${REPO_DIR:-/opt/tosu-thien}"
cd "$REPO"

echo "==> git pull"
git pull origin main

echo "==> Docker rebuild"
docker compose up -d --build

echo "==> Sync static web + nginx permissions"
if [[ -f www/index.html ]]; then
  sudo chown -R www-data:www-data www
  sudo chmod -R 755 www
fi

if [[ -x deploy/nginx/install-on-vps.sh ]]; then
  ./deploy/nginx/install-on-vps.sh
fi

echo "==> Health"
curl -sf http://127.0.0.1:8000/api/health && echo ""
curl -sfI http://127.0.0.1:5173 | head -1
curl -sfI http://tosuthien.net | head -1 || true

docker compose ps
