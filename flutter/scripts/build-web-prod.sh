#!/usr/bin/env bash
# Build Flutter web for https://tosuthien.net
set -euo pipefail

cd "$(dirname "$0")/.."

API_URL="${API_BASE_URL:-https://api.tosuthien.net}"

echo "==> flutter build web (API_BASE_URL=$API_URL)"
flutter build web \
  --release \
  --dart-define=API_BASE_URL="$API_URL"

echo ""
echo "Done. Output: flutter/build/web/"
echo "Deploy to VPS:"
echo "  rsync -avz build/web/ root@168.144.120.72:/opt/tosu-thien/www/"
echo "Or run: ../deploy/scripts/deploy-flutter-web.sh"
