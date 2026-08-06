#!/usr/bin/env bash
# One-shot on VPS that hosts demo.tosuthien.net (DNS A → this machine's public IP).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "==> git pull"
git pull origin main

echo "==> Build + start Next site (:5175)"
chmod +x deploy/scripts/deploy-site-on-vps.sh
./deploy/scripts/deploy-site-on-vps.sh

echo "==> Nginx (demo.tosuthien.net)"
chmod +x deploy/nginx/install-demo-on-vps.sh
./deploy/nginx/install-demo-on-vps.sh

echo ""
echo "============================================"
echo "HTTP: curl -I http://demo.tosuthien.net"
echo "HTTPS:"
echo "  sudo certbot --nginx -d demo.tosuthien.net"
echo "Later add tosuthien.com:"
echo "  sudo certbot --nginx --expand -d demo.tosuthien.net -d tosuthien.com -d www.tosuthien.com"
echo "============================================"
