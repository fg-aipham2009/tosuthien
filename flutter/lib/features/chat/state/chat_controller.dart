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
  List<RagSourceBook> _sources = [];
  bool _sourcesLoading = false;

  /// Throttle UI rebuilds while tokens arrive.
  DateTime? _lastStreamNotify;
  static const _streamNotifyInterval = Duration(milliseconds: 48);
  static const _maxHistoryTurns = 8;

  List<ChatConversation> get conversations => List.unmodifiable(_conversations);
  List<RagSourceBook> get sources => List.unmodifiable(_sources);
  bool get sourcesLoading => _sourcesLoading;

  ChatConversation? get activeConversation {
    if (_activeId == null) return null;
    for (final c in _conversations) {
      if (c.id == _activeId) return c;
    }
    return null;
  }

  List<ChatMessage> get messages => activeConversation?.messages ?? const [];
  List<String> get selectedSourceFiles =>
      activeConversation?.sourceFiles ?? const [];
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

  String get filterLabel {
    final selected = selectedSourceFiles;
    if (selected.isEmpty) return 'Tất cả sách';
    if (selected.length == 1) {
      for (final book in _sources) {
        if (book.sourceFile == selected.first) return book.shortLabel;
      }
      return selected.first;
    }
    return '${selected.length} sách';
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
    await loadSources();
  }

  Future<void> loadSources() async {
    if (_sourcesLoading) return;
    _sourcesLoading = true;
    notifyListeners();
    try {
      _sources = await _repository.fetchSources();
    } catch (e) {
      // Non-fatal: chat still works without filter UI data.
      debugPrint('loadSources failed: $e');
    } finally {
      _sourcesLoading = false;
      notifyListeners();
    }
  }

  void newConversation() {
    final id = DateTime.now().microsecondsSinceEpoch.toString();
    final conversation = ChatConversation(
      id: id,
      title: 'Cuộc trò chuyện mới',
      updatedAt: DateTime.now(),
      messages: const [],
      sourceFiles: const [],
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

  void setSourceFiles(List<String> files) {
    if (_activeId == null) newConversation();
    final conversationId = _activeId!;
    final normalized = files
        .map((f) => f.trim())
        .where((f) => f.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    _updateConversation(
      conversationId,
      (c) => c.copyWith(
        sourceFiles: normalized,
        updatedAt: DateTime.now(),
      ),
    );
    notifyListeners();
  }

  void toggleSourceFile(String sourceFile) {
    final current = [...selectedSourceFiles];
    if (current.contains(sourceFile)) {
      current.remove(sourceFile);
    } else {
      current.add(sourceFile);
    }
    setSourceFiles(current);
  }

  void clearSourceFilter() => setSourceFiles(const []);

  Future<void> sendMessage(String text) async {
    final question = text.trim();
    if (question.isEmpty || _loading) return;

    if (_activeId == null) {
      newConversation();
    }

    final conversationId = _activeId!;
    final priorHistory = _buildHistoryPayload(messages);
    final sourceFiles = selectedSourceFiles;

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
      await for (final event in _repository.askStream(
        question,
        sourceFiles: sourceFiles,
        messages: priorHistory,
      )) {
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

  /// Prior turns for the API (exclude the question about to be asked).
  List<Map<String, String>> _buildHistoryPayload(List<ChatMessage> msgs) {
    final turns = <Map<String, String>>[];
    for (final m in msgs) {
      if (m.isStreaming) continue;
      final content = m.content.trim();
      if (content.isEmpty) continue;
      turns.add({
        'role': m.role == ChatMessageRole.user ? 'user' : 'assistant',
        'content': content,
      });
    }
    if (turns.length <= _maxHistoryTurns) return turns;
    return turns.sublist(turns.length - _maxHistoryTurns);
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
