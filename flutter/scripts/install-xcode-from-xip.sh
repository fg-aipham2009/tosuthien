#!/usr/bin/env bash
# After downloading Xcode_16.4.xip from developer.apple.com
set -euo pipefail

DOWNLOADS="$HOME/Downloads"
XIP=$(ls -t "$DOWNLOADS"/Xcode_16.4*.xip 2>/dev/null | head -1 || true)

echo "=== Cài Xcode 16.4 từ Apple Developer ==="
echo ""

if [[ -d "/Applications/Xcode.app" ]]; then
  echo "✅ Đã có /Applications/Xcode.app"
  exec "$(dirname "$0")/setup-xcode-after-install.sh"
fi

if [[ -z "$XIP" ]]; then
  echo "1. Trình duyệt đã mở: https://developer.apple.com/download/all/?q=Xcode%2016.4"
  echo "2. Đăng nhập Apple ID → tải file Xcode_16.4.xip (~7GB) vào Downloads"
  echo "3. Chạy lại script này sau khi tải xong"
  echo ""
  open "https://developer.apple.com/download/all/?q=Xcode%2016.4"
  exit 0
fi

echo "Tìm thấy: $XIP"
echo "Giải nén (5–15 phút)..."
cd "$DOWNLOADS"
xip -x "$(basename "$XIP")"

if [[ ! -d "$DOWNLOADS/Xcode.app" ]]; then
  echo "❌ Giải nén xong nhưng không thấy Xcode.app trong Downloads"
  exit 1
fi

echo "Di chuyển vào Applications (cần mật khẩu Mac)..."
sudo rm -rf /Applications/Xcode.app
sudo mv "$DOWNLOADS/Xcode.app" /Applications/

echo "✅ Xcode đã cài vào /Applications/Xcode.app"
exec "$(dirname "$0")/setup-xcode-after-install.sh"
