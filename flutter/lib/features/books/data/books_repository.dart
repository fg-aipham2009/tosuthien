import '../../../core/device/device_id.dart';
import '../../../core/network/api_client.dart';
import '../models/book_pdf.dart';

class BooksRepository {
  BooksRepository({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;
  String? _deviceId;

  Future<String> _resolveDeviceId() async {
    _deviceId ??= await DeviceId.get();
    return _deviceId!;
  }

  Future<List<BookPdf>> fetchBooks() async {
    final deviceId = await _resolveDeviceId();
    final rows = await _client.getList(
      '/pdfs',
      query: {'device_id': deviceId},
    );

    return rows
        .whereType<Map<String, dynamic>>()
        .map(BookPdf.fromJson)
        .toList();
  }

  /// Latest reading progress for one book (online / per device).
  Future<BookPdf?> fetchBookById(String id) async {
    final deviceId = await _resolveDeviceId();
    try {
      final json = await _client.getObject(
        '/pdfs/$id',
        query: {'device_id': deviceId},
      );
      return BookPdf.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveReadingProgress({
    required String pdfFileId,
    required int lastPage,
  }) async {
    final deviceId = await _resolveDeviceId();
    await _client.put('/reading-progress', {
      'deviceId': deviceId,
      'pdfFileId': pdfFileId,
      'lastPage': lastPage,
    });
  }

  /// Match RAG citation `2.txt` → `pdf_files` row for `2.pdf`.
  Future<BookPdf?> findBySourceFile(String? sourceFile) async {
    final stem = _sourceStem(sourceFile);
    if (stem == null) return null;

    final books = await fetchBooks();
    for (final book in books) {
      final bookStem = book.filename.replaceAll(RegExp(r'\.pdf$', caseSensitive: false), '');
      if (bookStem == stem) return book;
      if (book.storagePath == 'pdf/$stem.pdf') return book;
    }
    return null;
  }

  static String? _sourceStem(String? sourceFile) {
    if (sourceFile == null || sourceFile.isEmpty) return null;
    final name = sourceFile.split('/').last;
    final m = RegExp(r'^(\d+)\.txt$', caseSensitive: false).firstMatch(name);
    return m?.group(1);
  }

  void dispose() => _client.dispose();
}
