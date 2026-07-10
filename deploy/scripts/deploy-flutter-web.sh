#!/usr/bin/env bash
# Build Flutter web on Mac and rsync to VPS (run from repo root).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-root@168.144.120.72}"
VPS_WWW="${VPS_WWW:-/opt/tosu-thien/www}"
API_URL="${API_BASE_URL:-https://api.tosuthien.net/}"

cd "$REPO_ROOT/flutter"
chmod +x scripts/build-web-prod.sh
API_BASE_URL="$API_URL" ./scripts/build-web-prod.sh

echo "==> rsync → $VPS_HOST:$VPS_WWW"
rsync -avz --delete build/web/ "$VPS_HOST:$VPS_WWW/"

echo "==> Fix permissions on VPS"
ssh "$VPS_HOST" "chown -R www-data:www-data $VPS_WWW && chmod -R 755 $VPS_WWW"

echo ""
echo "Open: https://tosuthien.net"
