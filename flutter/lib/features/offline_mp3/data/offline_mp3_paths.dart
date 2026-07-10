/// Shared naming helpers for offline MP3 downloads (no dart:io).
abstract final class OfflineMp3Paths {
  static const folderName = 'offline_mp3';
  static const prefsKey = 'offline_mp3_downloads_v1';
  static const legacyCombinedKey = 'offline_mp3_library_v1';

  static String fileNameForTrackId(String trackId) {
    final safe = trackId.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    return '$safe.mp3';
  }
}
