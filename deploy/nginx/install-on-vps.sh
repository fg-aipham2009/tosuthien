#!/usr/bin/env bash
# Install nginx + static roots on VPS (run after git pull).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==> Nginx site configs"
chmod +x "$REPO_ROOT/deploy/nginx/sync-sites-on-vps.sh"
"$REPO_ROOT/deploy/nginx/sync-sites-on-vps.sh"

echo "==> Flutter web root (app.tosuthien.net)"
WWW_ROOT="/opt/tosu-thien/www"
sudo mkdir -p "$WWW_ROOT"
sudo chown -R www-data:www-data "$WWW_ROOT"
sudo chmod -R 755 "$WWW_ROOT"

echo "==> Portal web root (tosuthien.net)"
PORTAL_ROOT="/opt/tosu-thien/portal-dist"
sudo mkdir -p "$PORTAL_ROOT"
if [[ -d "$REPO_ROOT/portal/dist" ]] && [[ -f "$REPO_ROOT/portal/dist/index.html" ]]; then
  sudo rsync -a --delete "$REPO_ROOT/portal/dist/" "$PORTAL_ROOT/"
fi
sudo chown -R www-data:www-data "$PORTAL_ROOT"
sudo chmod -R 755 "$PORTAL_ROOT"

echo ""
echo "Done. Portal: https://tosuthien.net  ·  App: https://app.tosuthien.net  ·  Demo: https://demo.tosuthien.net"
