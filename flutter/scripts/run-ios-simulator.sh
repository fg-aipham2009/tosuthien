#!/usr/bin/env bash
# iOS Simulator — requires Xcode 16.4 on macOS 15
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

if [[ ! -d "/Applications/Xcode.app" ]]; then
  echo "❌ Chưa có Xcode → không mở được iOS Simulator."
  echo "   Tải Xcode 16.4 từ developer.apple.com → ./scripts/install-xcode-from-xip.sh"
  open "https://developer.apple.com/download/all/?q=Xcode%2016.4"
  exit 1
fi

open -a Simulator 2>/dev/null || true
sleep 3

# iCloud Desktop adds FinderInfo/fileprovider xattrs that break codesign on build/ios.
IOS_BUILD_DIR="${TMPDIR:-/tmp}/tosuthien-ios-build"
mkdir -p "$IOS_BUILD_DIR"
if [[ -L build/ios ]]; then
  :
elif [[ -d build/ios ]]; then
  rm -rf build/ios
  ln -s "$IOS_BUILD_DIR" build/ios
else
  mkdir -p build
  ln -s "$IOS_BUILD_DIR" build/ios
fi

echo "Thiết bị iOS:"
flutter devices

flutter run -d ios --dart-define=API_BASE_URL=http://localhost:8000
