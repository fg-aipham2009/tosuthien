#!/usr/bin/env bash
# Build and run Next.js site/ (demo.tosuthien.net → :5175). Run on VPS after git pull.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SITE_DIR="$REPO_ROOT/site"

export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://demo.tosuthien.net}"
export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-https://api.tosuthien.net}"

cd "$SITE_DIR"

if ! command -v node >/dev/null; then
  echo "Node.js required (v20+). Install: https://nodejs.org or nvm" >&2
  exit 1
fi

echo "==> Build site (SITE_URL=$NEXT_PUBLIC_SITE_URL API=$NEXT_PUBLIC_API_BASE_URL)"
npm ci
npm run build

echo "==> Install systemd unit (tosu-site)"
sudo cp "$REPO_ROOT/deploy/vps/tosu-site.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tosu-site
sudo systemctl restart tosu-site

sleep 2
if curl -sfI "http://127.0.0.1:5175" | head -1; then
  echo "Site OK on :5175"
else
  echo "WARN: site not responding on :5175 — journalctl -u tosu-site -n 50" >&2
  exit 1
fi

echo "Open (after nginx + SSL): $NEXT_PUBLIC_SITE_URL"
