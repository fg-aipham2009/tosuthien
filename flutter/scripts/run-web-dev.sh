#!/usr/bin/env bash
# Fast Flutter web dev — keep this terminal open; use r/R instead of re-running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${API_BASE_URL:-http://localhost:8000}"
PORT="${WEB_PORT:-5199}"

echo "=== Flutter web dev (Tổ Sư Thiền) ==="
echo "URL:  http://localhost:$PORT"
echo "API:  $API_URL"
echo ""
echo "Sau khi sửa code:"
echo "  r  → hot reload   (~1–2 giây, UI/Dart)"
echo "  R  → hot restart  (~3–8 giây, main.dart / audio init)"
echo "  q  → thoát"
echo ""
echo "Tránh: F5 browser hoặc chạy lại flutter run (15–30 giây)."
echo "Cần full rebuild chỉ khi đổi pubspec.yaml / Android / iOS native."
echo ""

exec flutter run -d chrome \
  --dart-define=API_BASE_URL="$API_URL" \
  --web-port="$PORT"
