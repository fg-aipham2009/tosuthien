enum ChatMessageRole { user, assistant }

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.createdAt,
    this.disclaimer,
    this.citations = const [],
    this.isStreaming = false,
  });

  final String id;
  final ChatMessageRole role;
  final String content;
  final DateTime createdAt;
  final String? disclaimer;
  final List<ChatCitation> citations;
  /// True while SSE tokens are still arriving (not persisted).
  final bool isStreaming;

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
      isStreaming: false,
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
    bool? isStreaming,
  }) {
    return ChatMessage(
      id: id,
      role: role,
      content: content ?? this.content,
      createdAt: createdAt,
      disclaimer: disclaimer ?? this.disclaimer,
      citations: citations ?? this.citations,
      isStreaming: isStreaming ?? this.isStreaming,
    );
  }
}

class ChatCitationPdf {
  const ChatCitationPdf({
    required this.pdfFileId,
    required this.pdfTitle,
    required this.pdfSlug,
    required this.pdfUrl,
    this.pageNum,
    this.openLabel,
  });

  final String pdfFileId;
  final String pdfTitle;
  final String pdfSlug;
  final String pdfUrl;
  final int? pageNum;
  final String? openLabel;

  factory ChatCitationPdf.fromJson(Map<String, dynamic> json) {
    return ChatCitationPdf(
      pdfFileId: json['pdfFileId'] as String? ?? '',
      pdfTitle: json['pdfTitle'] as String? ?? '',
      pdfSlug: json['pdfSlug'] as String? ?? '',
      pdfUrl: _stripPageHash(json['pdfUrl'] as String? ?? ''),
      pageNum: _asInt(json['pageNum']),
      openLabel: json['openLabel'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'pdfFileId': pdfFileId,
        'pdfTitle': pdfTitle,
        'pdfSlug': pdfSlug,
        'pdfUrl': pdfUrl,
        if (pageNum != null) 'pageNum': pageNum,
        if (openLabel != null) 'openLabel': openLabel,
      };

  static String _stripPageHash(String url) {
    final i = url.indexOf('#');
    return i >= 0 ? url.substring(0, i) : url;
  }

  static int? _asInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }
}

class ChatCitation {
  const ChatCitation({
    required this.label,
    required this.title,
    required this.body,
    this.pageNum,
    this.pageStart,
    this.pageEnd,
    this.volume,
    this.sourceFile,
    this.pdf,
    this.openLabel,
  });

  final String label;
  final String title;
  /// Full passage text for display (prefers API `excerpt` over short `quote`).
  final String body;
  final int? pageNum;
  final int? pageStart;
  final int? pageEnd;
  final String? volume;
  final String? sourceFile;
  final ChatCitationPdf? pdf;
  final String? openLabel;

  /// `2.txt` → `2` for matching `2.pdf` in pdf_files.
  String? get sourceStem {
    final file = sourceFile;
    if (file == null || file.isEmpty) return null;
    final name = file.split('/').last;
    final m = RegExp(r'^(\d+)\.txt$', caseSensitive: false).firstMatch(name);
    return m?.group(1);
  }

  int? get openPage => pageStart ?? pageNum ?? pdf?.pageNum;

  String get pageLabel {
    final start = pageStart ?? pageNum;
    final end = pageEnd ?? pageNum;
    if (start == null) return '';
    if (end != null && end > start) return 'tr.$start–$end';
    return 'tr.$start';
  }

  bool get canOpenPdf =>
      openPage != null &&
      (sourceStem != null ||
          (pdf != null && pdf!.pdfFileId.isNotEmpty && pdf!.pdfUrl.isNotEmpty));

  String get openButtonLabel =>
      openLabel ??
      pdf?.openLabel ??
      (pageLabel.isNotEmpty ? 'Mở $pageLabel' : 'Mở kinh sách');

  factory ChatCitation.fromJson(Map<String, dynamic> json) {
    final excerpt = (json['excerpt'] as String? ?? json['body'] as String? ?? '').trim();
    final quote = (json['quote'] as String? ?? '').trim();
    final body = excerpt.length >= quote.length ? excerpt : quote;
    final pdfRaw = json['pdf'];
    return ChatCitation(
      label: json['label'] as String? ?? json['title'] as String? ?? 'Nguồn',
      title: json['title'] as String? ?? '',
      body: body,
      pageNum: _asInt(json['pageNum']),
      pageStart: _asInt(json['pageStart']),
      pageEnd: _asInt(json['pageEnd']),
      volume: json['volume'] as String?,
      sourceFile: json['sourceFile'] as String?,
      pdf: pdfRaw is Map<String, dynamic>
          ? ChatCitationPdf.fromJson(pdfRaw)
          : null,
      openLabel: json['openLabel'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'label': label,
        'title': title,
        'body': body,
        if (pageNum != null) 'pageNum': pageNum,
        if (pageStart != null) 'pageStart': pageStart,
        if (pageEnd != null) 'pageEnd': pageEnd,
        if (volume != null) 'volume': volume,
        if (sourceFile != null) 'sourceFile': sourceFile,
        if (pdf != null) 'pdf': pdf!.toJson(),
        if (openLabel != null) 'openLabel': openLabel,
      };

  static int? _asInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }
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
