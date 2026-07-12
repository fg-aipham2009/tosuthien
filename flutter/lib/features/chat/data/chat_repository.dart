import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../../core/config/api_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_exception.dart';
import '../models/chat_models.dart';

sealed class ChatStreamEvent {
  const ChatStreamEvent();
}

class ChatStreamStatus extends ChatStreamEvent {
  const ChatStreamStatus(this.phase);
  final String phase; // retrieving | generating
}

class ChatStreamDelta extends ChatStreamEvent {
  const ChatStreamDelta(this.text);
  final String text;
}

class ChatStreamDone extends ChatStreamEvent {
  const ChatStreamDone({
    required this.answer,
    this.aiInterpretation,
    required this.disclaimer,
    required this.citations,
  });

  final String answer;
  final String? aiInterpretation;
  final String disclaimer;
  final List<ChatCitation> citations;
}

class ChatStreamError extends ChatStreamEvent {
  const ChatStreamError(this.message);
  final String message;
}

class ChatRepository {
  ChatRepository({ApiClient? client, http.Client? httpClient})
      : _client = client ?? ApiClient(),
        _http = httpClient ?? http.Client(),
        _ownsHttp = httpClient == null;

  final ApiClient _client;
  final http.Client _http;
  final bool _ownsHttp;

  Future<
      ({
        String answer,
        String? aiInterpretation,
        String disclaimer,
        List<ChatCitation> citations,
      })> ask(
    String question,
  ) async {
    final json = await _client.post('/rag/chat', {'question': question});
    final citations = (json['citations'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(ChatCitation.fromJson)
        .toList();

    return (
      answer: json['answer'] as String? ?? '',
      aiInterpretation: json['aiInterpretation'] as String?,
      disclaimer: json['disclaimer'] as String? ?? '',
      citations: citations,
    );
  }

  /// Server-Sent Events from POST /rag/chat/stream.
  Stream<ChatStreamEvent> askStream(String question) async* {
    final uri = Uri.parse('${ApiConfig.api}/rag/chat/stream');
    final request = http.Request('POST', uri)
      ..headers.addAll({
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      })
      ..bodyBytes = utf8.encode(jsonEncode({'question': question}));

    final response = await _http.send(request);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final body = await response.stream.bytesToString();
      String message = 'HTTP ${response.statusCode}';
      try {
        final err = jsonDecode(body);
        if (err is Map && err['message'] != null) {
          message = '${err['message']}';
        } else if (body.isNotEmpty) {
          message = body;
        }
      } catch (_) {
        if (body.isNotEmpty) message = body;
      }
      throw ApiException(message, statusCode: response.statusCode);
    }

    String? eventName;
    final dataLines = <String>[];
    var lineBuffer = '';

    await for (final chunk in response.stream.transform(utf8.decoder)) {
      lineBuffer += chunk;
      final parts = lineBuffer.split('\n');
      lineBuffer = parts.removeLast();

      for (var raw in parts) {
        if (raw.endsWith('\r')) raw = raw.substring(0, raw.length - 1);

        if (raw.isEmpty) {
          if (eventName != null || dataLines.isNotEmpty) {
            final event = _parseSseEvent(
              eventName ?? 'message',
              dataLines.join('\n'),
            );
            if (event != null) yield event;
          }
          eventName = null;
          dataLines.clear();
          continue;
        }

        if (raw.startsWith(':')) continue;
        if (raw.startsWith('event:')) {
          eventName = raw.substring(6).trim();
          continue;
        }
        if (raw.startsWith('data:')) {
          dataLines.add(raw.substring(5).trimLeft());
        }
      }
    }

    if (lineBuffer.isNotEmpty) {
      var raw = lineBuffer;
      if (raw.endsWith('\r')) raw = raw.substring(0, raw.length - 1);
      if (raw.startsWith('event:')) {
        eventName = raw.substring(6).trim();
      } else if (raw.startsWith('data:')) {
        dataLines.add(raw.substring(5).trimLeft());
      }
    }

    if (eventName != null || dataLines.isNotEmpty) {
      final event = _parseSseEvent(
        eventName ?? 'message',
        dataLines.join('\n'),
      );
      if (event != null) yield event;
    }
  }

  ChatStreamEvent? _parseSseEvent(String name, String data) {
    if (data.isEmpty) return null;

    Map<String, dynamic>? json;
    try {
      final decoded = jsonDecode(data);
      if (decoded is Map<String, dynamic>) json = decoded;
    } catch (_) {
      return null;
    }
    if (json == null) return null;

    final type = (json['type'] as String?) ?? name;

    switch (type) {
      case 'status':
        return ChatStreamStatus(json['phase'] as String? ?? 'retrieving');
      case 'delta':
        return ChatStreamDelta(json['text'] as String? ?? '');
      case 'done':
        final citations = (json['citations'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(ChatCitation.fromJson)
            .toList();
        return ChatStreamDone(
          answer: json['answer'] as String? ?? '',
          aiInterpretation: json['aiInterpretation'] as String?,
          disclaimer: json['disclaimer'] as String? ?? '',
          citations: citations,
        );
      case 'error':
        return ChatStreamError(
          json['message'] as String? ?? 'Lỗi không xác định',
        );
      default:
        return null;
    }
  }

  void dispose() {
    _client.dispose();
    if (_ownsHttp) _http.close();
  }
}
