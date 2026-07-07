#!/usr/bin/env bash
# Run Flutter on a physical iPhone (requires Xcode 16.4 + USB trust)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d "/Applications/Xcode.app" ]]; then
  echo "❌ Chưa có Xcode.app — cài Xcode 16.4 qua app Xcodes trước."
  open -a Xcodes 2>/dev/null || true
  echo "   Sau khi cài xong: ./scripts/setup-xcode-after-install.sh"
  exit 1
fi

MAC_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [[ -z "$MAC_IP" ]]; then
  echo "❌ Không lấy được IP Mac (Wi‑Fi). iPhone và Mac phải cùng mạng."
  exit 1
fi

API_URL="http://${MAC_IP}:8000"
echo "Mac IP: $MAC_IP"
echo "API:    $API_URL"
echo ""
echo "Trên iPhone:"
echo "  1. Cắm USB → Trust This Computer"
echo "  2. Settings → Privacy & Security → Developer Mode → ON (nếu có)"
echo "  3. Mở Xcode một lần → Settings → Accounts → thêm Apple ID (signing)"
echo ""

if ! curl -sf "${API_URL}/api/health" >/dev/null 2>&1; then
  echo "⚠️  API chưa phản hồi tại $API_URL"
  echo "   Bật Docker: docker start tosu_db tosu_api"
  echo "   (iPhone không dùng được localhost — phải dùng IP Mac)"
fi

echo "Đang tìm iPhone..."
flutter devices

echo ""
echo "Chạy app trên thiết bị iOS..."
flutter run -d ios --dart-define=API_BASE_URL="$API_URL"
