#!/usr/bin/env bash
# macOS desktop — often faster hot reload than Chrome web for UI work.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${API_BASE_URL:-http://localhost:8000}"

echo "=== Flutter macOS dev ==="
echo "API: $API_URL"
echo "  r = hot reload | R = hot restart | q = quit"
echo ""

exec flutter run -d macos --dart-define=API_BASE_URL="$API_URL"
