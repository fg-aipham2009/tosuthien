#!/usr/bin/env bash
# Apply correct nginx + SSL on VPS (demo = Next :5175, admin = :5173, portal = static).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "==> git pull"
git pull origin main

echo "==> Copy nginx configs"
sudo cp "$REPO_ROOT/deploy/nginx/api.tosuthien.net.conf" /etc/nginx/sites-available/
sudo cp "$REPO_ROOT/deploy/nginx/admin.tosuthien.net.conf" /etc/nginx/sites-available/
sudo cp "$REPO_ROOT/deploy/nginx/app.tosuthien.net.conf" /etc/nginx/sites-available/
sudo cp "$REPO_ROOT/deploy/nginx/demo.tosuthien.net.conf" /etc/nginx/sites-available/
sudo cp "$REPO_ROOT/deploy/nginx/tosuthien.net.conf" /etc/nginx/sites-available/

sudo ln -sf /etc/nginx/sites-available/api.tosuthien.net.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/admin.tosuthien.net.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/app.tosuthien.net.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/demo.tosuthien.net.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/tosuthien.net.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

echo "==> Ensure demo SSL cert exists"
if [[ ! -f /etc/letsencrypt/live/demo.tosuthien.net/fullchain.pem ]]; then
  sudo certbot certonly --nginx -d demo.tosuthien.net --non-interactive --agree-tos --register-unsafely-without-email
fi

echo "==> nginx test + reload (before site build — API TLS must work)"
sudo nginx -t
sudo systemctl reload nginx

echo "==> Site Next (demo.tosuthien.net)"
chmod +x deploy/scripts/deploy-site-on-vps.sh
./deploy/scripts/deploy-site-on-vps.sh

echo "==> Portal Vue (tosuthien.net)"
chmod +x deploy/scripts/deploy-portal-on-vps.sh
./deploy/scripts/deploy-portal-on-vps.sh || echo "WARN: portal build failed — run deploy-portal-on-vps.sh after npm deps"

echo ""
echo "Verify:"
echo "  curl -I https://demo.tosuthien.net   # Next site"
echo "  curl -I https://admin.tosuthien.net  # Vue admin"
echo "  curl -I https://tosuthien.net        # portal-dist"
