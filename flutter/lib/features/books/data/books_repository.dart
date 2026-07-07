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

  void dispose() => _client.dispose();
}
