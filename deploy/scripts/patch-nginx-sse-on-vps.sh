#!/usr/bin/env bash
# Patch live nginx api.tosuthien.net for SSE, then reload.
# Usage (asks for VPS password):
#   ./deploy/scripts/patch-nginx-sse-on-vps.sh
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@168.144.120.72}"

echo "==> SSH $VPS_HOST — enter password if prompted"
ssh -t "$VPS_HOST" 'bash -s' <<'REMOTE'
set -euo pipefail

CONF=""
for c in \
  /etc/nginx/sites-available/api.tosuthien.net.conf \
  /etc/nginx/sites-enabled/api.tosuthien.net.conf \
  /etc/nginx/conf.d/api.tosuthien.net.conf
do
  if [[ -f "$c" ]]; then CONF="$c"; break; fi
done

if [[ -z "${CONF}" ]]; then
  echo "ERROR: api nginx config not found"
  ls -la /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null || true
  exit 1
fi

echo "==> Config: $CONF"
cp -a "$CONF" "${CONF}.bak.$(date +%Y%m%d-%H%M%S)"

python3 - "$CONF" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
lines = path.read_text().splitlines(keepends=True)
needed = [
    ("proxy_buffering off;", "proxy_buffering"),
    ("proxy_cache off;", "proxy_cache"),
    ("proxy_request_buffering off;", "proxy_request_buffering"),
    ("chunked_transfer_encoding on;", "chunked_transfer_encoding"),
]

changed = False
out = []
i = 0
while i < len(lines):
    line = lines[i]
    out.append(line)
    if "proxy_pass" in line and "8000" in line:
        window = "".join(lines[i : min(i + 50, len(lines))])
        indent = "        "
        for directive, key in needed:
            if key not in window:
                out.append(f"{indent}{directive}\n")
                changed = True
                print(f"  + {directive}")
    i += 1

if changed:
    path.write_text("".join(out))
    print(f"==> Updated {path}")
else:
    print("==> SSE settings already present")
PY

echo "==> nginx -t"
nginx -t
echo "==> systemctl reload nginx"
systemctl reload nginx
echo "==> verify"
grep -nE 'proxy_buffering|proxy_cache|proxy_request_buffering|proxy_pass|listen|server_name' "$CONF" | head -50
echo "OK — nginx reloaded"
REMOTE
