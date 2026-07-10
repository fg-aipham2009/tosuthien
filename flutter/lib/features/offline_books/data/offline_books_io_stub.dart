/// Stub for web — no local PDF files.
class OfflineBooksIo {
  static Future<String> rootPath() async {
    throw UnsupportedError('Offline books not available on this platform');
  }

  static Future<bool> fileExists(String absolutePath) async => false;

  static Future<void> deleteFile(String absolutePath) async {}

  static Future<void> writeStream(
    String absolutePath,
    Stream<List<int>> stream, {
    void Function(int received)? onBytes,
  }) async {
    throw UnsupportedError('Offline books download not available on web');
  }

  static bool get isSupported => false;

  static Uri? fileUri(String absolutePath) => null;
}
