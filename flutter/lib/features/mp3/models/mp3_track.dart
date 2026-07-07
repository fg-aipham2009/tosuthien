class Mp3Track {
  const Mp3Track({
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

  Duration? get duration =>
      durationSec != null ? Duration(seconds: durationSec!) : null;

  factory Mp3Track.fromJson(Map<String, dynamic> json) {
    final category = json['category'] as Map<String, dynamic>?;
    return Mp3Track(
      id: json['id'] as String,
      title: json['title'] as String,
      year: json['year'] as int,
      publicUrl: json['publicUrl'] as String,
      categoryId: json['categoryId'] as String? ?? category?['id'] as String?,
      categoryName: category?['name'] as String?,
      filename: json['filename'] as String?,
      folderPath: json['folderPath'] as String?,
      location: json['location'] as String?,
      durationSec: json['durationSec'] as int?,
    );
  }
}
