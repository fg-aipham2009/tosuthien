#!/usr/bin/env bash
# Install Xcode 16.4 for macOS 15.7 (Sequoia) — Apple docs: requires macOS 15.3+
# App Store Xcode 27 needs macOS 26+ — use Xcodes app or developer.apple.com instead.
set -euo pipefail

echo "=== Xcode 16.4 cho macOS 15.7 ==="
echo ""
echo "Theo Apple: Xcode 16.4 chạy trên macOS Sequoia 15.3 – 15.x"
echo "Máy bạn: $(sw_vers -productVersion)"
echo ""

if [[ -d "/Applications/Xcode.app" ]]; then
  echo "Đã có Xcode.app — chạy setup..."
  exec "$(dirname "$0")/setup-xcode-after-install.sh"
fi

if [[ -d "/Applications/Xcodes.app" ]]; then
  echo "1. App Xcodes đã cài — đang mở..."
  open -a Xcodes
  echo ""
  echo "2. Trong Xcodes:"
  echo "   - Sign in Apple ID (nút đăng nhập góc trên)"
  echo "   - Tìm: Xcode 16.4 (Release, build 16F6)"
  echo "   - Bấm Install → chọn /Applications"
  echo "   - Chờ tải ~7GB và giải nén"
  echo ""
  echo "3. Sau khi cài xong, chạy lại:"
  echo "   ./scripts/setup-xcode-after-install.sh"
else
  echo "Mở trang tải Apple Developer..."
  open "https://developer.apple.com/download/all/?q=Xcode%2016.4"
  echo ""
  echo "Tải file Xcode_16.4.xip → double-click giải nén → kéo Xcode vào Applications"
  echo "Rồi chạy: ./scripts/setup-xcode-after-install.sh"
fi
