enum ChatMessageRole { user, assistant }

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.createdAt,
    this.disclaimer,
    this.citations = const [],
  });

  final String id;
  final ChatMessageRole role;
  final String content;
  final DateTime createdAt;
  final String? disclaimer;
  final List<ChatCitation> citations;

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      role: ChatMessageRole.values.byName(json['role'] as String),
      content: json['content'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      disclaimer: json['disclaimer'] as String?,
      citations: (json['citations'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ChatCitation.fromJson)
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role.name,
        'content': content,
        'createdAt': createdAt.toIso8601String(),
        if (disclaimer != null) 'disclaimer': disclaimer,
        'citations': citations.map((c) => c.toJson()).toList(),
      };

  ChatMessage copyWith({
    String? content,
    String? disclaimer,
    List<ChatCitation>? citations,
  }) {
    return ChatMessage(
      id: id,
      role: role,
      content: content ?? this.content,
      createdAt: createdAt,
      disclaimer: disclaimer ?? this.disclaimer,
      citations: citations ?? this.citations,
    );
  }
}

class ChatCitation {
  const ChatCitation({
    required this.label,
    required this.title,
    required this.quote,
    this.pageNum,
  });

  final String label;
  final String title;
  final String quote;
  final int? pageNum;

  factory ChatCitation.fromJson(Map<String, dynamic> json) {
    return ChatCitation(
      label: json['label'] as String? ?? json['title'] as String? ?? 'Nguồn',
      title: json['title'] as String? ?? '',
      quote: json['quote'] as String? ?? json['excerpt'] as String? ?? '',
      pageNum: json['pageNum'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
        'label': label,
        'title': title,
        'quote': quote,
        if (pageNum != null) 'pageNum': pageNum,
      };
}

class ChatConversation {
  const ChatConversation({
    required this.id,
    required this.title,
    required this.updatedAt,
    required this.messages,
  });

  final String id;
  final String title;
  final DateTime updatedAt;
  final List<ChatMessage> messages;

  factory ChatConversation.fromJson(Map<String, dynamic> json) {
    return ChatConversation(
      id: json['id'] as String,
      title: json['title'] as String,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      messages: (json['messages'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ChatMessage.fromJson)
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'updatedAt': updatedAt.toIso8601String(),
        'messages': messages.map((m) => m.toJson()).toList(),
      };

  ChatConversation copyWith({
    String? title,
    DateTime? updatedAt,
    List<ChatMessage>? messages,
  }) {
    return ChatConversation(
      id: id,
      title: title ?? this.title,
      updatedAt: updatedAt ?? this.updatedAt,
      messages: messages ?? this.messages,
    );
  }
}
