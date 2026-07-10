import 'package:http/http.dart' as http;

import 'offline_mp3_io.dart';
import 'offline_mp3_paths.dart';

/// Downloads remote MP3 bytes into the isolated offline folder (native only).
class OfflineMp3Downloader {
  OfflineMp3Downloader({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  bool get isSupported => OfflineMp3Io.isSupported;

  Future<String> download({
    required String trackId,
    required String remoteUrl,
    void Function(double progress)? onProgress,
  }) async {
    if (!OfflineMp3Io.isSupported) {
      throw OfflineMp3DownloadException(
        'Tải offline chỉ hỗ trợ trên app (iOS/Android), chưa hỗ trợ web.',
      );
    }

    final uri = Uri.parse(remoteUrl);
    final request = http.Request('GET', uri);
    final response = await _client.send(request);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw OfflineMp3DownloadException(
        'Tải thất bại (HTTP ${response.statusCode})',
      );
    }

    final total = response.contentLength ?? 0;
    final fileName = OfflineMp3Paths.fileNameForTrackId(trackId);
    final root = await OfflineMp3Io.rootPath();
    final absolutePath = '$root/$fileName';

    var received = 0;
    await OfflineMp3Io.writeStream(
      absolutePath,
      response.stream,
      onBytes: (n) {
        received += n;
        if (total > 0 && onProgress != null) {
          onProgress(received / total);
        }
      },
    );
    onProgress?.call(1);
    return fileName;
  }

  Future<void> deleteLocalFile(String localFileName) async {
    if (!OfflineMp3Io.isSupported) return;
    final root = await OfflineMp3Io.rootPath();
    await OfflineMp3Io.deleteFile('$root/$localFileName');
  }

  void dispose() => _client.close();
}

class OfflineMp3DownloadException implements Exception {
  OfflineMp3DownloadException(this.message);
  final String message;

  @override
  String toString() => message;
}
