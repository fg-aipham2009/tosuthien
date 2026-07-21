#!/usr/bin/env bash
# Build Vue portal and publish to /opt/tosu-thien/portal on VPS.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORTAL_SRC="$REPO_ROOT/portal"
PORTAL_DST="/opt/tosu-thien/portal"

cd "$PORTAL_SRC"
npm ci
npm run build

sudo mkdir -p "$PORTAL_DST"
sudo rsync -a --delete "$PORTAL_SRC/dist/" "$PORTAL_DST/"
sudo chown -R www-data:www-data "$PORTAL_DST"
sudo chmod -R 755 "$PORTAL_DST"

echo "Published portal → $PORTAL_DST"
echo "Open https://tosuthien.net"
