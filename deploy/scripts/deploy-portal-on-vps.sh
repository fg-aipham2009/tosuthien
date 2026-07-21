#!/usr/bin/env bash
# Build Vue portal and publish to /opt/tosu-thien/portal-dist on VPS.
# Never publish into git-tracked portal/ (git pull would restore Vite source).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORTAL_SRC="$REPO_ROOT/portal"
PORTAL_DST="/opt/tosu-thien/portal-dist"

cd "$PORTAL_SRC"
npm ci
npm run build

if grep -qE '/src/main\.(ts|js)' dist/index.html; then
  echo "ERROR: dist/index.html still points at Vite source" >&2
  exit 1
fi

sudo mkdir -p "$PORTAL_DST"
sudo rsync -a --delete "$PORTAL_SRC/dist/" "$PORTAL_DST/"
sudo chown -R www-data:www-data "$PORTAL_DST"
sudo chmod -R 755 "$PORTAL_DST"

echo "Published portal → $PORTAL_DST"
echo "Open https://tosuthien.net"
