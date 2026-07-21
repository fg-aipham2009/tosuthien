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

echo "==> install into /opt/tosu-thien/portal-dist/"
ssh "$VPS_HOST" bash -s <<'REMOTE'
set -euo pipefail
sudo mkdir -p /opt/tosu-thien/portal-dist
sudo rsync -a --delete /tmp/portal-dist/ /opt/tosu-thien/portal-dist/
test -f /opt/tosu-thien/portal-dist/index.html
if grep -qE '/src/main\.(ts|js)' /opt/tosu-thien/portal-dist/index.html; then
  echo "ERROR: live index.html points at Vite source — deploy aborted mid-flight?" >&2
  exit 1
fi
ENTRY=$(grep -oE '/assets/index-[^"]+\.js' /opt/tosu-thien/portal-dist/index.html | head -1)
test -n "$ENTRY"
test -f "/opt/tosu-thien/portal-dist${ENTRY}"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://tosuthien.net${ENTRY}")
CT=$(curl -sI "https://tosuthien.net${ENTRY}" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2; exit}')
echo "entry ${ENTRY} -> HTTP ${CODE} ${CT}"
test "$CODE" = "200"
echo "$CT" | grep -qi 'javascript'
REMOTE

echo "OK — portal deployed. Hard-refresh the browser (Cmd+Shift+R) if an old tab still shows MIME/404 errors."
