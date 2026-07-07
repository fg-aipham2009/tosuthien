import 'package:flutter_test/flutter_test.dart';

import 'package:tosuthien/features/chat/models/chat_models.dart';

void main() {
  test('ChatConversation round-trip JSON', () {
    final conversation = ChatConversation(
      id: '1',
      title: 'Thiền là gì?',
      updatedAt: DateTime.parse('2026-07-06T12:00:00'),
      messages: [
        ChatMessage(
          id: 'm1',
          role: ChatMessageRole.user,
          content: 'Thiền là gì?',
          createdAt: DateTime.parse('2026-07-06T12:00:00'),
        ),
      ],
    );

    final restored = ChatConversation.fromJson(conversation.toJson());
    expect(restored.title, 'Thiền là gì?');
    expect(restored.messages.length, 1);
  });
}
