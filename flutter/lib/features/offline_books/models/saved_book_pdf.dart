import '../../books/models/book_pdf.dart';

class SavedBookPdf {
  const SavedBookPdf({
    required this.id,
    required this.slug,
    required this.title,
    this.volume,
    required this.author,
    required this.filename,
    required this.storagePath,
    required this.publicUrl,
    this.pageCount,
    this.sortOrder = 0,
    this.localFileName,
    this.downloadedAt,
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
  final int sortOrder;
  final String? localFileName;
  final DateTime? downloadedAt;

  bool get isDownloaded => localFileName != null && localFileName!.isNotEmpty;

  String get displayTitle =>
      volume != null && volume!.isNotEmpty ? '$title — $volume' : title;

  factory SavedBookPdf.fromBook(
    BookPdf book, {
    String? localFileName,
    DateTime? downloadedAt,
  }) {
    return SavedBookPdf(
      id: book.id,
      slug: book.slug,
      title: book.title,
      volume: book.volume,
      author: book.author,
      filename: book.filename,
      storagePath: book.storagePath,
      publicUrl: book.publicUrl,
      pageCount: book.pageCount,
      sortOrder: book.sortOrder,
      localFileName: localFileName,
      downloadedAt: downloadedAt,
    );
  }

  factory SavedBookPdf.fromJson(Map<String, dynamic> json) {
    return SavedBookPdf(
      id: json['id'] as String,
      slug: json['slug'] as String? ?? '',
      title: json['title'] as String? ?? 'Sách',
      volume: json['volume'] as String?,
      author: json['author'] as String? ?? '',
      filename: json['filename'] as String? ?? '',
      storagePath: json['storagePath'] as String? ?? '',
      publicUrl: json['publicUrl'] as String? ?? '',
      pageCount: json['pageCount'] as int?,
      sortOrder: json['sortOrder'] as int? ?? 0,
      localFileName: json['localFileName'] as String?,
      downloadedAt: json['downloadedAt'] is String
          ? DateTime.tryParse(json['downloadedAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'slug': slug,
        'title': title,
        'volume': volume,
        'author': author,
        'filename': filename,
        'storagePath': storagePath,
        'publicUrl': publicUrl,
        if (pageCount != null) 'pageCount': pageCount,
        'sortOrder': sortOrder,
        if (localFileName != null) 'localFileName': localFileName,
        if (downloadedAt != null)
          'downloadedAt': downloadedAt!.toIso8601String(),
      };

  BookPdf toBook({String? overridePublicUrl}) {
    return BookPdf(
      id: id,
      slug: slug,
      title: title,
      volume: volume,
      author: author,
      filename: filename,
      storagePath: storagePath,
      publicUrl: overridePublicUrl ?? publicUrl,
      pageCount: pageCount,
      sortOrder: sortOrder,
    );
  }
}
