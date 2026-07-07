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
    notifyListeners();

    try {
      final result = await _repository.ask(question);
      final assistantMessage = ChatMessage(
        id: '${DateTime.now().microsecondsSinceEpoch}-a',
        role: ChatMessageRole.assistant,
        content: result.answer,
        createdAt: DateTime.now(),
        disclaimer: result.disclaimer.isEmpty ? null : result.disclaimer,
        citations: result.citations,
      );

      _updateConversation(
        conversationId,
        (c) => c.copyWith(
          updatedAt: DateTime.now(),
          messages: [...c.messages, assistantMessage],
        ),
      );
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      await _persist();
      notifyListeners();
    }
  }

  void _updateConversation(
    String id,
    ChatConversation Function(ChatConversation) transform,
  ) {
    _conversations = _conversations.map((c) {
      if (c.id == id) return transform(c);
      return c;
    }).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    _persist();
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
