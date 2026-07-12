class TextBook {
  const TextBook({
    required this.id,
    required this.title,
    required this.author,
    required this.pageCount,
    this.blankPages = 0,
    this.source,
    this.pdfFileId,
    this.lastPage,
    this.lastReadAt,
  });

  final String id;
  final String title;
  final String author;
  final int pageCount;
  final int blankPages;
  final String? source;
  final String? pdfFileId;
  final int? lastPage;
  final DateTime? lastReadAt;

  factory TextBook.fromJson(Map<String, dynamic> json) {
    DateTime? lastReadAt;
    final raw = json['lastReadAt'];
    if (raw is String) lastReadAt = DateTime.tryParse(raw);

    return TextBook(
      id: '${json['id']}',
      title: (json['title'] as String?)?.trim().isNotEmpty == true
          ? json['title'] as String
          : 'Kinh sách ${json['id']}',
      author: (json['author'] as String?) ?? 'Hòa thượng Thích Duy Lực',
      pageCount: _asInt(json['pageCount']) ?? 0,
      blankPages: _asInt(json['blankPages']) ?? 0,
      source: json['source'] as String?,
      pdfFileId: json['pdfFileId'] as String?,
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

class TextBookPage {
  const TextBookPage({
    required this.page,
    required this.text,
    this.isBlank = false,
  });

  final int page;
  final String text;
  final bool isBlank;

  factory TextBookPage.fromJson(Map<String, dynamic> json) {
    final text = (json['text'] as String?) ?? '';
    return TextBookPage(
      page: TextBook._asInt(json['page']) ?? 0,
      text: text,
      isBlank: json['isBlank'] == true || text.trim().isEmpty,
    );
  }
}
