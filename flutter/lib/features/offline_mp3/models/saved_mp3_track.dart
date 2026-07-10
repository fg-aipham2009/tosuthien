import '../../mp3/models/mp3_track.dart';

/// Snapshot of an MP3 track kept on-device (favorites and/or downloads).
/// Isolated from online browsing models to keep offline paths crash-safe.
class SavedMp3Track {
  const SavedMp3Track({
    required this.id,
    required this.title,
    required this.year,
    required this.publicUrl,
    this.categoryId,
    this.categoryName,
    this.filename,
    this.folderPath,
    this.location,
    this.durationSec,
    this.localFileName,
    this.downloadedAt,
    this.favoritedAt,
  });

  final String id;
  final String title;
  final int year;
  final String publicUrl;
  final String? categoryId;
  final String? categoryName;
  final String? filename;
  final String? folderPath;
  final String? location;
  final int? durationSec;

  /// Relative filename under the offline_mp3 support directory.
  final String? localFileName;
  final DateTime? downloadedAt;
  final DateTime? favoritedAt;

  bool get isDownloaded => localFileName != null && localFileName!.isNotEmpty;
  bool get isFavorite => favoritedAt != null;

  Duration? get duration =>
      durationSec != null ? Duration(seconds: durationSec!) : null;

  factory SavedMp3Track.fromTrack(
    Mp3Track track, {
    String? localFileName,
    DateTime? downloadedAt,
    DateTime? favoritedAt,
  }) {
    return SavedMp3Track(
      id: track.id,
      title: track.title,
      year: track.year,
      publicUrl: track.publicUrl,
      categoryId: track.categoryId,
      categoryName: track.categoryName,
      filename: track.filename,
      folderPath: track.folderPath,
      location: track.location,
      durationSec: track.durationSec,
      localFileName: localFileName,
      downloadedAt: downloadedAt,
      favoritedAt: favoritedAt,
    );
  }

  factory SavedMp3Track.fromJson(Map<String, dynamic> json) {
    return SavedMp3Track(
      id: json['id'] as String,
      title: json['title'] as String? ?? 'MP3',
      year: json['year'] as int? ?? 0,
      publicUrl: json['publicUrl'] as String? ?? '',
      categoryId: json['categoryId'] as String?,
      categoryName: json['categoryName'] as String?,
      filename: json['filename'] as String?,
      folderPath: json['folderPath'] as String?,
      location: json['location'] as String?,
      durationSec: json['durationSec'] as int?,
      localFileName: json['localFileName'] as String?,
      downloadedAt: _parseDate(json['downloadedAt']),
      favoritedAt: _parseDate(json['favoritedAt']),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'year': year,
        'publicUrl': publicUrl,
        if (categoryId != null) 'categoryId': categoryId,
        if (categoryName != null) 'categoryName': categoryName,
        if (filename != null) 'filename': filename,
        if (folderPath != null) 'folderPath': folderPath,
        if (location != null) 'location': location,
        if (durationSec != null) 'durationSec': durationSec,
        if (localFileName != null) 'localFileName': localFileName,
        if (downloadedAt != null) 'downloadedAt': downloadedAt!.toIso8601String(),
        if (favoritedAt != null) 'favoritedAt': favoritedAt!.toIso8601String(),
      };

  Mp3Track toTrack({String? overridePublicUrl}) {
    return Mp3Track(
      id: id,
      title: title,
      year: year,
      publicUrl: overridePublicUrl ?? publicUrl,
      categoryId: categoryId,
      categoryName: categoryName,
      filename: filename,
      folderPath: folderPath,
      location: location,
      durationSec: durationSec,
    );
  }

  SavedMp3Track copyWith({
    String? localFileName,
    DateTime? downloadedAt,
    DateTime? favoritedAt,
    bool clearLocalFile = false,
    bool clearFavorite = false,
    bool clearDownload = false,
  }) {
    return SavedMp3Track(
      id: id,
      title: title,
      year: year,
      publicUrl: publicUrl,
      categoryId: categoryId,
      categoryName: categoryName,
      filename: filename,
      folderPath: folderPath,
      location: location,
      durationSec: durationSec,
      localFileName: clearLocalFile ? null : (localFileName ?? this.localFileName),
      downloadedAt: clearDownload ? null : (downloadedAt ?? this.downloadedAt),
      favoritedAt: clearFavorite ? null : (favoritedAt ?? this.favoritedAt),
    );
  }

  static DateTime? _parseDate(Object? raw) {
    if (raw is! String || raw.isEmpty) return null;
    return DateTime.tryParse(raw);
  }
}
