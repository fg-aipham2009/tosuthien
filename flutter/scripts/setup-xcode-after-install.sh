#!/usr/bin/env bash
# Run once after Xcode 16.4 is installed to /Applications/Xcode.app
set -euo pipefail

if [[ ! -d "/Applications/Xcode.app" ]]; then
  echo "Chưa thấy /Applications/Xcode.app"
  echo "Chạy trước: ./scripts/install-xcode-16.sh"
  exit 1
fi

echo "Cấu hình Xcode (cần mật khẩu Mac)..."
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
sudo xcodebuild -license accept || true

echo "Cài iOS Simulator runtime (nếu chưa có)..."
xcodebuild -downloadPlatform iOS 2>&1 || true

echo "CocoaPods..."
export LANG=en_US.UTF-8
pod --version 2>/dev/null || brew install cocoapods

cd "$(dirname "$0")/.."
flutter precache --ios 2>&1 || true

open -a Simulator 2>/dev/null || true

echo ""
flutter doctor -v 2>&1 | rg -A8 "Xcode|Connected device" || flutter doctor

echo ""
echo "Done. Chạy app iOS:"
echo "  flutter run -d ios --dart-define=API_BASE_URL=http://localhost:8000"
