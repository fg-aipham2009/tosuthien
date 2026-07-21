import '../../../core/config/api_config.dart';

class BookPdf {
  const BookPdf({
    required this.id,
    required this.slug,
    required this.title,
    this.volume,
    required this.author,
    required this.filename,
    required this.storagePath,
    required this.publicUrl,
    this.pageCount,
    this.coverImageUrl,
    this.sortOrder = 0,
    this.lastPage,
    this.lastReadAt,
  });

  final String id;
  final String slug;
  final String title;
  final String? volume;
  final String author;
  final String filename;
  final String storagePath;
  final String publicUrl;
  final int? pageCount;
  final String? coverImageUrl;
  final int sortOrder;
  final int? lastPage;
  final DateTime? lastReadAt;

  String get displayTitle {
    final t = title.trim();
    final v = volume?.trim();
    if (v == null || v.isEmpty) return t;
    if (t.toLowerCase().contains(v.toLowerCase())) return t;
    return '$t — $v';
  }

  String get pdfUrl {
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      return publicUrl;
    }
    final path = publicUrl.startsWith('/') ? publicUrl.substring(1) : publicUrl;
    if (path.startsWith('files/')) {
      return '${ApiConfig.baseUrl}/$path';
    }
    return '${ApiConfig.baseUrl}/files/$storagePath';
  }

  factory BookPdf.fromJson(Map<String, dynamic> json) {
    DateTime? lastReadAt;
    final rawDate = json['lastReadAt'];
    if (rawDate is String) {
      lastReadAt = DateTime.tryParse(rawDate);
    }

    return BookPdf(
      id: json['id'] as String,
      slug: json['slug'] as String,
      title: json['title'] as String,
      volume: json['volume'] as String?,
      author: (json['author'] as String?) ?? 'Hòa thượng Thích Duy Lực',
      filename: json['filename'] as String,
      storagePath: json['storagePath'] as String,
      publicUrl: json['publicUrl'] as String,
      pageCount: _asInt(json['pageCount']),
      coverImageUrl: json['coverImageUrl'] as String?,
      sortOrder: _asInt(json['sortOrder']) ?? 0,
      lastPage: _asInt(json['lastPage']),
      lastReadAt: lastReadAt,
    );
  }

  static int? _asInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }
}
