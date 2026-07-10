import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../mp3/models/mp3_track.dart';
import '../data/offline_mp3_downloader.dart';
import '../data/offline_mp3_io.dart';
import '../data/offline_mp3_paths.dart';
import '../models/saved_mp3_track.dart';

/// Downloaded MP3 files only (offline playback).
/// Favorites live in [Mp3FavoritesStore] — never mixed here.
class OfflineMp3Library extends ChangeNotifier {
  OfflineMp3Library({
    OfflineMp3Downloader? downloader,
  }) : _downloader = downloader ?? OfflineMp3Downloader();

  final OfflineMp3Downloader _downloader;
  final Map<String, SavedMp3Track> _byId = {};
  final Set<String> _downloadingIds = {};
  bool _ready = false;
  String? _lastError;

  bool get isReady => _ready;
  bool get downloadsSupported => _downloader.isSupported;
  String? get lastError => _lastError;
  Set<String> get downloadingIds => Set.unmodifiable(_downloadingIds);

  /// @deprecated Use [Mp3FavoritesStore] — kept empty for API compatibility.
  List<SavedMp3Track> get favorites => const [];

  List<SavedMp3Track> get downloads {
    final list = _byId.values.where((t) => t.isDownloaded).toList();
    list.sort((a, b) => (b.downloadedAt ?? DateTime(0))
        .compareTo(a.downloadedAt ?? DateTime(0)));
    return list;
  }

  bool isFavorite(String trackId) => false;
  bool isDownloaded(String trackId) => _byId[trackId]?.isDownloaded ?? false;
  bool isDownloading(String trackId) => _downloadingIds.contains(trackId);

  SavedMp3Track? getById(String trackId) => _byId[trackId];

  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _byId.clear();

      final raw = prefs.getString(OfflineMp3Paths.prefsKey);
      if (raw != null && raw.isNotEmpty) {
        await _loadDownloads(raw);
      } else {
        final legacy = prefs.getString(OfflineMp3Paths.legacyCombinedKey);
        if (legacy != null && legacy.isNotEmpty) {
          await _loadDownloads(legacy, downloadsOnly: true);
          await _persist();
        }
      }
      _ready = true;
      _lastError = null;
    } catch (e) {
      _ready = true;
      _lastError = 'Không đọc được MP3 offline: $e';
      debugPrint(_lastError);
    }
    notifyListeners();
  }

  Future<void> _loadDownloads(String raw, {bool downloadsOnly = false}) async {
    final decoded = jsonDecode(raw);
    if (decoded is! List) return;
    for (final item in decoded.whereType<Map>()) {
      var track = SavedMp3Track.fromJson(Map<String, dynamic>.from(item));
      if (downloadsOnly && !track.isDownloaded) continue;

      if (track.isDownloaded && track.localFileName != null) {
        if (OfflineMp3Io.isSupported) {
          final root = await OfflineMp3Io.rootPath();
          final exists =
              await OfflineMp3Io.fileExists('$root/${track.localFileName}');
          if (!exists) continue;
        } else {
          continue;
        }
      } else {
        continue;
      }

      // Strip favorite flag — downloads store is file-only.
      _byId[track.id] = SavedMp3Track.fromTrack(
        track.toTrack(),
        localFileName: track.localFileName,
        downloadedAt: track.downloadedAt ?? DateTime.now(),
      );
    }
  }

  Future<void> toggleFavorite(Mp3Track track) async {
    // Favorites moved to Mp3FavoritesStore — no-op here.
  }

  Future<void> download(Mp3Track track) async {
    if (isDownloaded(track.id) || isDownloading(track.id)) return;
    if (!_downloader.isSupported) {
      _lastError =
          'Tải offline chỉ hỗ trợ trên app (iOS/Android), chưa hỗ trợ web.';
      notifyListeners();
      throw OfflineMp3DownloadException(_lastError!);
    }
    if (track.publicUrl.trim().isEmpty) {
      _lastError = 'Bài này thiếu đường dẫn tải xuống';
      notifyListeners();
      return;
    }

    _downloadingIds.add(track.id);
    _lastError = null;
    notifyListeners();

    try {
      final fileName = await _downloader.download(
        trackId: track.id,
        remoteUrl: track.publicUrl,
      );
      _byId[track.id] = SavedMp3Track.fromTrack(
        track,
        localFileName: fileName,
        downloadedAt: DateTime.now(),
      );
      await _persist();
    } catch (e) {
      _lastError = e.toString();
      debugPrint('Offline MP3 download failed: $e');
      rethrow;
    } finally {
      _downloadingIds.remove(track.id);
      notifyListeners();
    }
  }

  Future<void> removeDownload(String trackId) async {
    final existing = _byId[trackId];
    if (existing == null) return;

    if (existing.localFileName != null) {
      await _downloader.deleteLocalFile(existing.localFileName!);
    }
    _byId.remove(trackId);
    await _persist();
    notifyListeners();
  }

  /// Local file URI for offline playback; falls back to remote URL.
  Future<Uri> playbackUriFor(Mp3Track track) async {
    final saved = _byId[track.id];
    if (saved?.localFileName != null && OfflineMp3Io.isSupported) {
      final root = await OfflineMp3Io.rootPath();
      final absolute = '$root/${saved!.localFileName}';
      if (await OfflineMp3Io.fileExists(absolute)) {
        return OfflineMp3Io.fileUri(absolute) ?? Uri.parse(track.publicUrl);
      }
    }
    return Uri.parse(track.publicUrl);
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    final payload = jsonEncode(_byId.values.map((t) => t.toJson()).toList());
    await prefs.setString(OfflineMp3Paths.prefsKey, payload);
  }

  @override
  void dispose() {
    _downloader.dispose();
    super.dispose();
  }
}
