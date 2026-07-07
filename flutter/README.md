# Tổ Sư Thiền (Flutter)

Mobile app: Hỏi đáp · MP3 · YouTube · Kinh sách · Thiền đường.

## Phiên bản nền tảng (ổn định — Flutter 3.44.4)

| Thành phần | Phiên bản | Ghi chú |
|------------|-----------|---------|
| Flutter | **3.44.4** stable | `.fvmrc` |
| Dart SDK | **^3.8.0** | |
| **Android compileSdk** | **36** | Android 16 SDK |
| **Android targetSdk** | **36** | Bắt buộc Play Store từ 08/2026 |
| **Android minSdk** | **36** | Chỉ Android 16+ (đổi `37` nếu chỉ Android 17+) |
| Android Gradle Plugin | **9.0.1** | |
| Gradle | **9.1.0** | |
| NDK | **28.2** | Theo Flutter SDK |
| Java / Kotlin JVM | **21** | LTS — AGP 9.x |
| **macOS deployment** | **15.0** | Sequoia trở lên |
| **macOS build SDK** | **macOS 15+** (Xcode 16+) | |
| **iOS deployment** | **18.0** | Khớp Xcode 16 trên macOS 15 (nâng 26 khi có macOS 26 + Xcode 27) |
| **Xcode khuyến nghị** | **16.4** | macOS 15.3+ — không dùng App Store (Xcode 27 cần macOS 26) |
| Swift | **5.0** | Theo Flutter 3.44 template |
| C++ standard | **gnu++20** | Android + Apple toolchain |

### Cài môi trường build

**Đã cài trên máy này**

- ✅ Android Studio + SDK 36 + Emulator `Pixel_API_36`
- ✅ `ANDROID_HOME` trong `~/.zshrc`
- ⏳ **Xcode 16.4** — cài qua app **Xcodes** (đã cài) hoặc [developer.apple.com](https://developer.apple.com/download/all/?q=Xcode%2016.4)

```bash
./scripts/install-xcode-16.sh      # mở Xcodes / trang tải
./scripts/setup-xcode-after-install.sh   # sau khi Xcode cài xong
```

Mở Android emulator:

```bash
./scripts/launch-android-emulator.sh
```

**Android**

1. Android Studio (bản mới nhất)
2. SDK Manager → cài **Android 16 (API 36)**; nếu target Android 17 thì thêm **API 37**
3. `export ANDROID_HOME=~/Library/Android/sdk`

**macOS**

1. Cài **Xcode 16** trở lên (SDK macOS 15 Sequoia)
2. `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
3. `sudo xcodebuild -license accept`
4. Máy build: macOS **15 Sequoia** trở lên (máy bạn: 15.7 ✓)

**iOS**

1. Cùng **Xcode 16+** như macOS
2. Cài iOS Simulator runtime (**iOS 27** khuyến nghị)
3. Apple Developer account để deploy lên thiết bị / App Store
4. Cấu hình tập trung: `ios/Runner/Configs/Platform.xcconfig`

## Cấu trúc thư mục

```
lib/
├── app/                 # MaterialApp, theme
├── core/
│   ├── config/          # API_BASE_URL
│   ├── network/         # ApiClient
│   └── widgets/         # Loading, Error, Empty, Placeholder…
└── features/
    ├── shell/           # Home + bottom nav
    ├── chat/
    ├── mp3/             # data · models · presentation · widgets
    ├── youtube/
    ├── books/
    └── centers/
```

## Chạy dev

```bash
# API (Docker — chạy 1 lần, để nguyên)
cd .. && docker compose up -d

# Flutter — giữ 1 terminal, đừng tắt mỗi lần sửa code
cd flutter
fvm flutter pub get

# Web (nhẹ, test nhanh)
./scripts/run-web-dev.sh

# macOS app (hot reload thường nhanh hơn web trên Mac)
./scripts/run-macos-dev.sh

# Mobile
fvm flutter run -d android --dart-define=API_BASE_URL=http://10.0.2.2:8000
./scripts/run-ios-simulator.sh
```

### Dev nhanh (hot reload)

| Thao tác | Thời gian | Khi nào |
|----------|-----------|---------|
| **`r`** trong terminal `flutter run` | ~1–2s | Sửa UI, widget, logic Dart |
| **`R`** hot restart | ~3–8s | Sửa `main.dart`, theme, init audio |
| **F5** browser / chạy lại `flutter run` | 15–30s+ | Tránh — chỉ khi hỏng state |
| **`flutter clean`** | vài phút | Chỉ khi lỗi build lạ |

`API_BASE_URL` mặc định `http://localhost:8000` — web/macOS không cần `--dart-define` nếu API chạy cổng 8000.


## Build release

```bash
fvm flutter build apk --release --dart-define=API_BASE_URL=https://api.example.com
fvm flutter build appbundle --release --dart-define=API_BASE_URL=https://api.example.com
fvm flutter build ios --release --dart-define=API_BASE_URL=https://api.example.com
fvm flutter build macos --release --dart-define=API_BASE_URL=https://api.example.com
```

Tab **MP3** hiện gọi `GET /api/mp3/tracks`. Các tab khác là placeholder.
