import '../../../../core/network/api_client.dart';
import '../models/chat_models.dart';

class ChatRepository {
  ChatRepository({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<({String answer, String disclaimer, List<ChatCitation> citations})> ask(
    String question,
  ) async {
    final json = await _client.post('/rag/chat', {'question': question});
    final citations = (json['citations'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(ChatCitation.fromJson)
        .toList();

    return (
      answer: json['answer'] as String? ?? '',
      disclaimer: json['disclaimer'] as String? ?? '',
      citations: citations,
    );
  }

  void dispose() => _client.dispose();
}
