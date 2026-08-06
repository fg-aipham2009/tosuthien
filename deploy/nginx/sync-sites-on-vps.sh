#!/usr/bin/env bash
# Copy all site configs from repo → nginx sites-enabled (includes HTTPS blocks).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NGINX_SRC="$REPO_ROOT/deploy/nginx"
NGINX_DST="/etc/nginx/sites-available"

if [[ ! -d "$NGINX_SRC" ]]; then
  echo "Missing $NGINX_SRC — run from repo at /opt/tosu-thien"
  exit 1
fi

for conf in \
  api.tosuthien.net.conf \
  admin.tosuthien.net.conf \
  app.tosuthien.net.conf \
  demo.tosuthien.net.conf \
  tosuthien.net.conf
do
  sudo cp "$NGINX_SRC/$conf" "$NGINX_DST/"
  sudo ln -sf "$NGINX_DST/$conf" /etc/nginx/sites-enabled/
done

sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
