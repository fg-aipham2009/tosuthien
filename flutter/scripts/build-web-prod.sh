#!/usr/bin/env bash
# Build Flutter web for https://tosuthien.net
set -euo pipefail

cd "$(dirname "$0")/.."

API_URL="${API_BASE_URL:-https://api.tosuthien.net/}"
BUILD_ID="${APP_BUILD_ID:-$(date +%Y%m%d-%H%M%S)}"

echo "==> flutter build web (API_BASE_URL=$API_URL, APP_BUILD_ID=$BUILD_ID)"
flutter build web \
  --release \
  --build-number "$BUILD_ID" \
  --dart-define=API_BASE_URL="$API_URL" \
  --dart-define=APP_BUILD_ID="$BUILD_ID"

echo ""
echo "Done. Output: flutter/build/web/"
echo "Deploy to VPS:"
echo "  rsync -avz build/web/ root@168.144.120.72:/opt/tosu-thien/www/"
echo "Or run: ../deploy/scripts/deploy-flutter-web.sh"
