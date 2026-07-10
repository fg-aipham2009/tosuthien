/// Stub for web / non-IO platforms: no local MP3 files.
class OfflineMp3Io {
  static Future<String> rootPath() async {
    throw UnsupportedError('Offline MP3 storage is not available on this platform');
  }

  static Future<bool> fileExists(String absolutePath) async => false;

  static Future<void> deleteFile(String absolutePath) async {}

  static Future<void> writeBytes(String absolutePath, List<int> bytes) async {
    throw UnsupportedError('Offline MP3 download is not available on this platform');
  }

  static Future<void> writeStream(
    String absolutePath,
    Stream<List<int>> stream, {
    void Function(int received)? onBytes,
  }) async {
    throw UnsupportedError('Offline MP3 download is not available on this platform');
  }

  static bool get isSupported => false;

  static Uri? fileUri(String absolutePath) => null;
}
