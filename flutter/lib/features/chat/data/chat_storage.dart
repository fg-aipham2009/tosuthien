import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/chat_models.dart';

class ChatStorage {
  static const _key = 'chat_conversations_v2';

  Future<List<ChatConversation>> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];

    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];

    return decoded
        .whereType<Map<String, dynamic>>()
        .map(ChatConversation.fromJson)
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  }

  Future<void> save(List<ChatConversation> conversations) async {
    final prefs = await SharedPreferences.getInstance();
    final payload = jsonEncode(conversations.map((c) => c.toJson()).toList());
    await prefs.setString(_key, payload);
  }
}
