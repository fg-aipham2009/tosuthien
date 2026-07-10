import 'package:http/http.dart' as http;

import 'offline_books_io.dart';
import 'offline_books_paths.dart';

class OfflineBooksDownloader {
  OfflineBooksDownloader({http.Client? client})
      : _client = client ?? http.Client();

  final http.Client _client;

  bool get isSupported => OfflineBooksIo.isSupported;

  Future<String> download({
    required String bookId,
    required String remoteUrl,
  }) async {
    if (!OfflineBooksIo.isSupported) {
      throw OfflineBooksDownloadException(
        'Tải sách offline chỉ hỗ trợ trên app (iOS/Android).',
      );
    }

    final request = http.Request('GET', Uri.parse(remoteUrl));
    final response = await _client.send(request);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw OfflineBooksDownloadException(
        'Tải thất bại (HTTP ${response.statusCode})',
      );
    }

    final fileName = OfflineBooksPaths.fileNameForBookId(bookId);
    final root = await OfflineBooksIo.rootPath();
    await OfflineBooksIo.writeStream('$root/$fileName', response.stream);
    return fileName;
  }

  Future<void> deleteLocalFile(String localFileName) async {
    if (!OfflineBooksIo.isSupported) return;
    final root = await OfflineBooksIo.rootPath();
    await OfflineBooksIo.deleteFile('$root/$localFileName');
  }

  void dispose() => _client.close();
}

class OfflineBooksDownloadException implements Exception {
  OfflineBooksDownloadException(this.message);
  final String message;

  @override
  String toString() => message;
}
