#!/usr/bin/env bash
# Run on the VPS after CI uploads a Flutter web tarball to /tmp.
# Env:
#   WEB_TARBALL  path to .tar.gz (default /tmp/tosuthien-web.tar.gz)
#   VPS_WWW      deploy dir (default /opt/tosu-thien/www)
set -euo pipefail

WEB_TARBALL="${WEB_TARBALL:-/tmp/tosuthien-web.tar.gz}"
VPS_WWW="${VPS_WWW:-/opt/tosu-thien/www}"
STAGING="${STAGING:-/tmp/tosuthien-web-staging}"

if [[ ! -f "$WEB_TARBALL" ]]; then
  echo "Missing tarball: $WEB_TARBALL" >&2
  exit 1
fi

echo "==> extract → $STAGING"
rm -rf "$STAGING"
mkdir -p "$STAGING"
tar -xzf "$WEB_TARBALL" -C "$STAGING"

echo "==> publish → $VPS_WWW"
mkdir -p "$VPS_WWW"
# Replace contents atomically-ish: sync into place then fix perms.
rsync -a --delete "$STAGING"/ "$VPS_WWW"/
chown -R www-data:www-data "$VPS_WWW"
chmod -R 755 "$VPS_WWW"

rm -rf "$STAGING"
rm -f "$WEB_TARBALL"

echo "Open: https://tosuthien.net"
