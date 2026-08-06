#!/usr/bin/env bash
# Install nginx config for demo.tosuthien.net only (VPS where demo DNS points).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NGINX_SRC="$REPO_ROOT/deploy/nginx"
NGINX_DST="/etc/nginx/sites-available"

sudo cp "$NGINX_SRC/demo.tosuthien.net.conf" "$NGINX_DST/"
sudo ln -sf "$NGINX_DST/demo.tosuthien.net.conf" /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx

echo "Nginx: demo.tosuthien.net → 127.0.0.1:5175"
