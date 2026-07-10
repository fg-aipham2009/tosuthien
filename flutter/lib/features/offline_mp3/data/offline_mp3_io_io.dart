import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'offline_mp3_paths.dart';

/// Native (iOS/Android/macOS/desktop) file helpers for offline MP3s.
class OfflineMp3Io {
  static Future<String> rootPath() async {
    final support = await getApplicationSupportDirectory();
    final dir = Directory('${support.path}/${OfflineMp3Paths.folderName}');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir.path;
  }

  static Future<bool> fileExists(String absolutePath) async {
    return File(absolutePath).exists();
  }

  static Future<void> deleteFile(String absolutePath) async {
    final file = File(absolutePath);
    if (await file.exists()) {
      await file.delete();
    }
  }

  static Future<void> writeBytes(String absolutePath, List<int> bytes) async {
    final file = File(absolutePath);
    await file.parent.create(recursive: true);
    await file.writeAsBytes(bytes, flush: true);
  }

  static Future<void> writeStream(
    String absolutePath,
    Stream<List<int>> stream, {
    void Function(int received)? onBytes,
  }) async {
    final file = File(absolutePath);
    final tmp = File('$absolutePath.part');
    await tmp.parent.create(recursive: true);
    final sink = tmp.openWrite();
    try {
      await for (final chunk in stream) {
        sink.add(chunk);
        onBytes?.call(chunk.length);
      }
      await sink.flush();
      await sink.close();
      if (await file.exists()) {
        await file.delete();
      }
      await tmp.rename(absolutePath);
    } catch (_) {
      await sink.close();
      if (await tmp.exists()) {
        await tmp.delete();
      }
      rethrow;
    }
  }

  static bool get isSupported => true;

  static Uri? fileUri(String absolutePath) => File(absolutePath).uri;
}
