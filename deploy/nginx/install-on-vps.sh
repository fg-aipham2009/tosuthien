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
# Preserve Certbot SSL blocks already on the live apex config if present.
if [[ -f /etc/nginx/sites-enabled/tosuthien.net.conf ]] \
  && grep -q "managed by Certbot" /etc/nginx/sites-enabled/tosuthien.net.conf; then
  echo "  Keeping live tosuthien.net.conf (Certbot SSL) — only sync other sites"
  sudo cp "$NGINX_SRC/api.tosuthien.net.conf" "$NGINX_DST/"
  sudo cp "$NGINX_SRC/admin.tosuthien.net.conf" "$NGINX_DST/"
  sudo cp "$NGINX_SRC/app.tosuthien.net.conf" "$NGINX_DST/"
else
  sudo cp "$NGINX_SRC/api.tosuthien.net.conf" "$NGINX_DST/"
  sudo cp "$NGINX_SRC/admin.tosuthien.net.conf" "$NGINX_DST/"
  sudo cp "$NGINX_SRC/app.tosuthien.net.conf" "$NGINX_DST/"
  sudo cp "$NGINX_SRC/tosuthien.net.conf" "$NGINX_DST/"
fi

echo "==> Enable sites"
sudo ln -sf "$NGINX_DST/api.tosuthien.net.conf" /etc/nginx/sites-enabled/
sudo ln -sf "$NGINX_DST/admin.tosuthien.net.conf" /etc/nginx/sites-enabled/
sudo ln -sf "$NGINX_DST/app.tosuthien.net.conf" /etc/nginx/sites-enabled/
sudo ln -sf "$NGINX_DST/tosuthien.net.conf" /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

echo "==> Flutter web root (app.tosuthien.net)"
WWW_ROOT="/opt/tosu-thien/www"
sudo mkdir -p "$WWW_ROOT"
if [[ -f "$REPO_ROOT/www/index.html" ]] && [[ ! -f "$WWW_ROOT/index.html" ]]; then
  sudo cp -a "$REPO_ROOT/www/." "$WWW_ROOT/"
fi
sudo chown -R www-data:www-data "$WWW_ROOT"
sudo chmod -R 755 "$WWW_ROOT"

echo "==> Portal web root (tosuthien.net) — separate from git portal/ source"
PORTAL_ROOT="/opt/tosu-thien/portal-dist"
sudo mkdir -p "$PORTAL_ROOT"
if [[ -d "$REPO_ROOT/portal/dist" ]] && [[ -f "$REPO_ROOT/portal/dist/index.html" ]]; then
  sudo rsync -a --delete "$REPO_ROOT/portal/dist/" "$PORTAL_ROOT/"
fi
sudo chown -R www-data:www-data "$PORTAL_ROOT"
sudo chmod -R 755 "$PORTAL_ROOT"

# Point apex at portal-dist if still on Flutter www or old portal/ path
for conf in /etc/nginx/sites-enabled/tosuthien.net.conf /etc/nginx/sites-available/tosuthien.net.conf; do
  [[ -f "$conf" ]] || continue
  if grep -qE 'root /opt/tosu-thien/(www|portal);' "$conf" 2>/dev/null; then
    echo "==> Switch tosuthien.net root → /opt/tosu-thien/portal-dist ($conf)"
    sudo sed -i 's|root /opt/tosu-thien/www;|root /opt/tosu-thien/portal-dist;|g' "$conf"
    sudo sed -i 's|root /opt/tosu-thien/portal;|root /opt/tosu-thien/portal-dist;|g' "$conf"
  fi
done

echo "==> Test and reload nginx"
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "Done. Portal: https://tosuthien.net  ·  App: https://app.tosuthien.net"
echo "  SSL: sudo certbot --nginx --expand -d tosuthien.net -d www.tosuthien.net -d app.tosuthien.net -d api.tosuthien.net -d admin.tosuthien.net"
