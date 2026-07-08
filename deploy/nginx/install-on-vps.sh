#!/usr/bin/env bash
# Install nginx site configs for tosuthien.net (run on VPS after git pull).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NGINX_SRC="$REPO_ROOT/deploy/nginx"
NGINX_DST="/etc/nginx/sites-available"

if [[ ! -d "$NGINX_SRC" ]]; then
  echo "Missing $NGINX_SRC — run from repo at /opt/tosu-thien"
  exit 1
fi

echo "==> Copy nginx configs to $NGINX_DST"
sudo cp "$NGINX_SRC/api.tosuthien.net.conf" "$NGINX_DST/"
sudo cp "$NGINX_SRC/admin.tosuthien.net.conf" "$NGINX_DST/"
sudo cp "$NGINX_SRC/tosuthien.net.conf" "$NGINX_DST/"

echo "==> Enable sites"
sudo ln -sf "$NGINX_DST/api.tosuthien.net.conf" /etc/nginx/sites-enabled/
sudo ln -sf "$NGINX_DST/admin.tosuthien.net.conf" /etc/nginx/sites-enabled/
sudo ln -sf "$NGINX_DST/tosuthien.net.conf" /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

echo "==> Create Flutter web root (if missing)"
sudo mkdir -p /opt/tosu-thien/www
sudo chown -R "$USER:$USER" /opt/tosu-thien/www

echo "==> Test and reload nginx"
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "Upload limit: 1 GiB per file (nginx + NestJS). Rebuild Docker after pull:"
echo "  docker compose up -d --build admin api"

echo ""
echo "Done. Next steps:"
echo "  1. docker compose up -d          # api :8000, admin :5173"
echo "  2. Copy Flutter build to www:"
echo "       rsync -av flutter/build/web/ /opt/tosu-thien/www/"
echo "  3. SSL:"
echo "       sudo certbot --nginx -d tosuthien.net -d www.tosuthien.net -d api.tosuthien.net -d admin.tosuthien.net"
echo "  4. .env: PUBLIC_BASE_URL=https://api.tosuthien.net"
echo "       docker compose up -d --force-recreate api"
