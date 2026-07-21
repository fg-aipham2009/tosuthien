#!/usr/bin/env bash
# Build portal and deploy ONLY dist/ to VPS (never Vite source).
# Usage: ./deploy/scripts/deploy-portal.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-tosuthien-vps}"
PORTAL_DIR="$REPO_ROOT/portal"
DIST="$PORTAL_DIR/dist"

cd "$PORTAL_DIR"
npm run build

if [[ ! -f "$DIST/index.html" ]]; then
  echo "ERROR: dist/index.html missing after build" >&2
  exit 1
fi

# Guard: production index must load hashed /assets/*.js — never /src/main.ts
if grep -E '/src/main\.(ts|js)|type="module"[^>]+src="/src/' "$DIST/index.html" >/dev/null; then
  echo "ERROR: dist/index.html still points at Vite source (/src/…). Refusing deploy." >&2
  exit 1
fi
if ! grep -E 'src="/assets/[^"]+\.js"' "$DIST/index.html" >/dev/null; then
  echo "ERROR: dist/index.html has no /assets/*.js module entry" >&2
  exit 1
fi
if [[ -d "$DIST/src" ]] || find "$DIST" -name '*.ts' -o -name '*.vue' | grep -q .; then
  echo "ERROR: dist/ contains source files (.ts/.vue). Refusing deploy." >&2
  exit 1
fi

echo "==> rsync dist/ → $VPS_HOST:/tmp/portal-dist/"
rsync -avz --delete "$DIST/" "$VPS_HOST:/tmp/portal-dist/"

echo "==> install into /opt/tosu-thien/portal/"
ssh "$VPS_HOST" 'sudo rsync -a --delete /tmp/portal-dist/ /opt/tosu-thien/portal/ && \
  test -f /opt/tosu-thien/portal/index.html && \
  ! grep -q "/src/main" /opt/tosu-thien/portal/index.html && \
  curl -sI https://tosuthien.net/assets/$(basename $(ls /opt/tosu-thien/portal/assets/index-*.js | head -1)) | head -5'

echo "OK — portal deployed. Hard-refresh the browser (Cmd+Shift+R) if an old tab still shows MIME errors."
