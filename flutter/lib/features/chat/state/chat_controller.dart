import 'package:flutter/foundation.dart';

import '../data/chat_repository.dart';
import '../data/chat_storage.dart';
import '../models/chat_models.dart';

class ChatController extends ChangeNotifier {
  ChatController({
    ChatRepository? repository,
    ChatStorage? storage,
  })  : _repository = repository ?? ChatRepository(),
        _storage = storage ?? ChatStorage();

  final ChatRepository _repository;
  final ChatStorage _storage;

  List<ChatConversation> _conversations = [];
  String? _activeId;
  bool _loading = false;
  String? _error;
  String _statusPhase = 'retrieving';

  /// Throttle UI rebuilds while tokens arrive.
  DateTime? _lastStreamNotify;
  static const _streamNotifyInterval = Duration(milliseconds: 48);

  List<ChatConversation> get conversations => List.unmodifiable(_conversations);
  ChatConversation? get activeConversation {
    if (_activeId == null) return null;
    for (final c in _conversations) {
      if (c.id == _activeId) return c;
    }
    return null;
  }

  List<ChatMessage> get messages => activeConversation?.messages ?? const [];
  bool get isLoading => _loading;
  String? get error => _error;

  /// retrieving | generating — for loading label before first token.
  String get statusPhase => _statusPhase;

  bool get showRetrievingRow => _loading && !_hasStreamingAssistant;

  bool get _hasStreamingAssistant {
    final msgs = messages;
    if (msgs.isEmpty) return false;
    final last = msgs.last;
    return last.role == ChatMessageRole.assistant && last.isStreaming;
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  Future<void> init() async {
    _conversations = await _storage.load();
    if (_conversations.isNotEmpty) {
      _activeId = _conversations.first.id;
    }
    notifyListeners();
  }

  void newConversation() {
    final id = DateTime.now().microsecondsSinceEpoch.toString();
    final conversation = ChatConversation(
      id: id,
      title: 'Cuộc trò chuyện mới',
      updatedAt: DateTime.now(),
      messages: const [],
    );
    _conversations = [conversation, ..._conversations];
    _activeId = id;
    _error = null;
    _persist();
    notifyListeners();
  }

  void selectConversation(String id) {
    _activeId = id;
    _error = null;
    notifyListeners();
  }

  Future<void> deleteConversation(String id) async {
    _conversations = _conversations.where((c) => c.id != id).toList();
    if (_activeId == id) {
      _activeId = _conversations.isEmpty ? null : _conversations.first.id;
    }
    await _persist();
    notifyListeners();
  }

  Future<void> sendMessage(String text) async {
    final question = text.trim();
    if (question.isEmpty || _loading) return;

    if (_activeId == null) {
      newConversation();
    }

    final conversationId = _activeId!;
    final userMessage = ChatMessage(
      id: '${DateTime.now().microsecondsSinceEpoch}-u',
      role: ChatMessageRole.user,
      content: question,
      createdAt: DateTime.now(),
    );

    final assistantId = '${DateTime.now().microsecondsSinceEpoch}-a';

    _updateConversation(
      conversationId,
      (c) => c.copyWith(
        title: c.messages.isEmpty ? _titleFrom(question) : c.title,
        updatedAt: DateTime.now(),
        messages: [...c.messages, userMessage],
      ),
    );

    _loading = true;
    _error = null;
    _statusPhase = 'retrieving';
    notifyListeners();

    var assistantCreated = false;

    void ensureAssistant() {
      if (assistantCreated) return;
      assistantCreated = true;
      _updateConversation(
        conversationId,
        (c) => c.copyWith(
          updatedAt: DateTime.now(),
          messages: [
            ...c.messages,
            ChatMessage(
              id: assistantId,
              role: ChatMessageRole.assistant,
              content: '',
              createdAt: DateTime.now(),
              isStreaming: true,
            ),
          ],
        ),
        persist: false,
      );
      notifyListeners();
    }

    try {
      await for (final event in _repository.askStream(question)) {
        switch (event) {
          case ChatStreamStatus(:final phase):
            _statusPhase = phase;
            if (phase == 'generating') ensureAssistant();
            notifyListeners();
          case ChatStreamDelta(:final text):
            if (text.isEmpty) continue;
            ensureAssistant();
            _appendAssistantDelta(conversationId, assistantId, text);
          case ChatStreamDone(
              :final answer,
              :final aiInterpretation,
              :final disclaimer,
              :final citations,
            ):
            ensureAssistant();
            _finishAssistant(
              conversationId,
              assistantId,
              answer: answer,
              aiInterpretation: aiInterpretation,
              disclaimer: disclaimer,
              citations: citations,
            );
          case ChatStreamError(:final message):
            throw Exception(message);
        }
      }
    } catch (e) {
      _error = e.toString();
      if (assistantCreated) {
        _removeEmptyAssistant(conversationId, assistantId);
      }
    } finally {
      _loading = false;
      await _persist();
      notifyListeners();
    }
  }

  void _appendAssistantDelta(
    String conversationId,
    String assistantId,
    String delta,
  ) {
    _updateConversation(conversationId, (c) {
      final messages = c.messages.map((m) {
        if (m.id != assistantId) return m;
        return m.copyWith(
          content: '${m.content}$delta',
          isStreaming: true,
        );
      }).toList();
      return c.copyWith(updatedAt: DateTime.now(), messages: messages);
    }, persist: false);

    final now = DateTime.now();
    if (_lastStreamNotify == null ||
        now.difference(_lastStreamNotify!) >= _streamNotifyInterval) {
      _lastStreamNotify = now;
      notifyListeners();
    }
  }

  void _finishAssistant(
    String conversationId,
    String assistantId, {
    required String answer,
    String? aiInterpretation,
    required String disclaimer,
    required List<ChatCitation> citations,
  }) {
    _updateConversation(conversationId, (c) {
      final messages = c.messages.map((m) {
        if (m.id != assistantId) return m;
        return m.copyWith(
          content: answer.isNotEmpty ? answer : m.content,
          aiInterpretation: aiInterpretation,
          clearAiInterpretation:
              aiInterpretation == null || aiInterpretation.isEmpty,
          disclaimer: disclaimer.isEmpty ? null : disclaimer,
          citations: citations,
          isStreaming: false,
        );
      }).toList();
      return c.copyWith(updatedAt: DateTime.now(), messages: messages);
    });
    notifyListeners();
  }

  void _removeEmptyAssistant(String conversationId, String assistantId) {
    _updateConversation(conversationId, (c) {
      final messages = c.messages
          .where(
            (m) =>
                !(m.id == assistantId &&
                    m.content.isEmpty &&
                    m.citations.isEmpty),
          )
          .map((m) {
            if (m.id == assistantId) return m.copyWith(isStreaming: false);
            return m;
          })
          .toList();
      return c.copyWith(messages: messages);
    });
  }

  void _updateConversation(
    String id,
    ChatConversation Function(ChatConversation) transform, {
    bool persist = true,
  }) {
    _conversations = _conversations.map((c) {
      if (c.id == id) return transform(c);
      return c;
    }).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    if (persist) _persist();
  }

  Future<void> _persist() => _storage.save(_conversations);

  String _titleFrom(String question) {
    final clean = question.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (clean.length <= 42) return clean;
    return '${clean.substring(0, 42)}…';
  }

  @override
  void dispose() {
    _repository.dispose();
    super.dispose();
  }
}
