import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../books/models/book_pdf.dart';
import '../data/offline_books_downloader.dart';
import '../data/offline_books_io.dart';
import '../data/offline_books_paths.dart';
import '../models/saved_book_pdf.dart';

/// Downloaded PDFs only — separate from MP3 offline storage.
class OfflineBooksLibrary extends ChangeNotifier {
  OfflineBooksLibrary({
    OfflineBooksDownloader? downloader,
  }) : _downloader = downloader ?? OfflineBooksDownloader();

  final OfflineBooksDownloader _downloader;
  final Map<String, SavedBookPdf> _byId = {};
  final Set<String> _downloadingIds = {};
  bool _ready = false;
  String? _lastError;

  bool get isReady => _ready;
  bool get downloadsSupported => _downloader.isSupported;
  String? get lastError => _lastError;

  List<SavedBookPdf> get downloads {
    final list = _byId.values.where((b) => b.isDownloaded).toList();
    list.sort((a, b) => (b.downloadedAt ?? DateTime(0))
        .compareTo(a.downloadedAt ?? DateTime(0)));
    return list;
  }

  bool isDownloaded(String bookId) => _byId[bookId]?.isDownloaded ?? false;
  bool isDownloading(String bookId) => _downloadingIds.contains(bookId);

  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _byId.clear();
      final raw = prefs.getString(OfflineBooksPaths.prefsKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          for (final item in decoded.whereType<Map>()) {
            var book =
                SavedBookPdf.fromJson(Map<String, dynamic>.from(item));
            if (!book.isDownloaded || book.localFileName == null) continue;
            if (OfflineBooksIo.isSupported) {
              final root = await OfflineBooksIo.rootPath();
              final exists = await OfflineBooksIo.fileExists(
                '$root/${book.localFileName}',
              );
              if (!exists) continue;
            } else {
              continue;
            }
            _byId[book.id] = book;
          }
        }
      }
      _ready = true;
      _lastError = null;
    } catch (e) {
      _ready = true;
      _lastError = 'Không đọc được sách offline: $e';
      debugPrint(_lastError);
    }
    notifyListeners();
  }

  Future<void> download(BookPdf book) async {
    if (isDownloaded(book.id) || isDownloading(book.id)) return;
    if (!_downloader.isSupported) {
      _lastError = 'Tải sách offline chỉ hỗ trợ trên app (iOS/Android).';
      notifyListeners();
      throw OfflineBooksDownloadException(_lastError!);
    }

    _downloadingIds.add(book.id);
    _lastError = null;
    notifyListeners();

    try {
      final fileName = await _downloader.download(
        bookId: book.id,
        remoteUrl: book.pdfUrl,
      );
      _byId[book.id] = SavedBookPdf.fromBook(
        book,
        localFileName: fileName,
        downloadedAt: DateTime.now(),
      );
      await _persist();
    } catch (e) {
      _lastError = e.toString();
      debugPrint('Offline book download failed: $e');
      rethrow;
    } finally {
      _downloadingIds.remove(book.id);
      notifyListeners();
    }
  }

  Future<void> removeDownload(String bookId) async {
    final existing = _byId[bookId];
    if (existing == null) return;
    if (existing.localFileName != null) {
      await _downloader.deleteLocalFile(existing.localFileName!);
    }
    _byId.remove(bookId);
    await _persist();
    notifyListeners();
  }

  /// Local file URI for offline reading, else remote URL.
  Future<String> openUrlFor(BookPdf book) async {
    final saved = _byId[book.id];
    if (saved?.localFileName != null && OfflineBooksIo.isSupported) {
      final root = await OfflineBooksIo.rootPath();
      final absolute = '$root/${saved!.localFileName}';
      if (await OfflineBooksIo.fileExists(absolute)) {
        return OfflineBooksIo.fileUri(absolute)?.toString() ?? book.pdfUrl;
      }
    }
    return book.pdfUrl;
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    final payload = jsonEncode(_byId.values.map((b) => b.toJson()).toList());
    await prefs.setString(OfflineBooksPaths.prefsKey, payload);
  }

  @override
  void dispose() {
    _downloader.dispose();
    super.dispose();
  }
}
