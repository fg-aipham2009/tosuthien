abstract final class OfflineBooksPaths {
  static const folderName = 'offline_books';
  static const prefsKey = 'offline_books_downloads_v1';

  static String fileNameForBookId(String bookId) {
    final safe = bookId.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    return '$safe.pdf';
  }
}
