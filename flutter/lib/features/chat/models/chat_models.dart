import 'pdf_page_offsets.dart';

enum ChatMessageRole { user, assistant }

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.createdAt,
    this.aiInterpretation,
    this.disclaimer,
    this.citations = const [],
    this.isStreaming = false,
  });

  final String id;
  final ChatMessageRole role;
  final String content;
  final DateTime createdAt;
  /// Separate AI commentary field from API (`aiInterpretation`); shown last.
  final String? aiInterpretation;
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
      aiInterpretation: json['aiInterpretation'] as String?,
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
        if (aiInterpretation != null) 'aiInterpretation': aiInterpretation,
        if (disclaimer != null) 'disclaimer': disclaimer,
        'citations': citations.map((c) => c.toJson()).toList(),
      };

  ChatMessage copyWith({
    String? content,
    String? aiInterpretation,
    String? disclaimer,
    List<ChatCitation>? citations,
    bool? isStreaming,
    bool clearAiInterpretation = false,
  }) {
    return ChatMessage(
      id: id,
      role: role,
      content: content ?? this.content,
      createdAt: createdAt,
      aiInterpretation: clearAiInterpretation
          ? null
          : (aiInterpretation ?? this.aiInterpretation),
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

class ChatCitationPageLink {
  const ChatCitationPageLink({
    required this.printed,
    required this.filePage,
    required this.openLabel,
  });

  final int printed;
  final int filePage;
  final String openLabel;

  factory ChatCitationPageLink.fromJson(Map<String, dynamic> json) {
    return ChatCitationPageLink(
      printed: _asInt(json['printed']) ?? 1,
      filePage: _asInt(json['filePage']) ?? _asInt(json['printed']) ?? 1,
      openLabel: json['openLabel'] as String? ?? 'tr.${json['printed']}',
    );
  }

  Map<String, dynamic> toJson() => {
        'printed': printed,
        'filePage': filePage,
        'openLabel': openLabel,
      };

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
    this.pages = const [],
    this.pageLinks = const [],
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
  /// Printed pages in this citation (one card, multiple tappable pages).
  final List<int> pages;
  final List<ChatCitationPageLink> pageLinks;
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

  /// Printed page for labels (may differ from PDF file index).
  int? get displayPage => pageNum ?? pageStart ?? pageEnd ?? pdf?.pageNum;

  /// PDF file page to open — prefer server `pageLinks` / `pdf.pageNum` (file index).
  int? get openPage {
    if (pdf?.pageNum != null) return pdf!.pageNum;
    final fromLinks = tappablePages.firstOrNull?.filePage;
    if (fromLinks != null) return fromLinks;
    final printed = pageNum ?? pageStart;
    if (printed == null) return null;
    return toPdfFilePage(sourceFile, printed);
  }

  List<ChatCitationPageLink> get tappablePages {
    if (pageLinks.isNotEmpty) return pageLinks;
    if (pages.isNotEmpty) {
      return [
        for (final p in pages)
          ChatCitationPageLink(
            printed: p,
            filePage: toPdfFilePage(sourceFile, p),
            openLabel: 'tr.$p',
          ),
      ];
    }
    final start = pageStart;
    final end = pageEnd;
    if (start != null && end != null && end >= start) {
      return [
        for (var p = start; p <= end; p++)
          ChatCitationPageLink(
            printed: p,
            filePage: toPdfFilePage(sourceFile, p),
            openLabel: 'tr.$p',
          ),
      ];
    }
    final single = pageNum;
    if (single != null) {
      return [
        ChatCitationPageLink(
          printed: single,
          filePage: toPdfFilePage(sourceFile, single),
          openLabel: 'tr.$single',
        ),
      ];
    }
    return const [];
  }

  String get pageLabel {
    final taps = tappablePages;
    if (taps.isEmpty) {
      final page = pageNum ?? pageStart ?? pageEnd ?? pdf?.pageNum;
      if (page == null) return '';
      return 'tr.$page';
    }
    if (taps.length == 1) return taps.first.openLabel;
    return taps.map((t) => t.openLabel).join(' · ');
  }

  bool get canOpenPdf =>
      (openPage != null || tappablePages.isNotEmpty) &&
      (sourceStem != null ||
          (pdf != null && pdf!.pdfFileId.isNotEmpty && pdf!.pdfUrl.isNotEmpty));

  String get openButtonLabel =>
      openLabel ??
      pdf?.openLabel ??
      (pageLabel.isNotEmpty ? 'Mở $pageLabel' : 'Mở kinh sách');

  ChatCitation copyWith({
    String? label,
    String? title,
    String? body,
    int? pageNum,
    int? pageStart,
    int? pageEnd,
    List<int>? pages,
    List<ChatCitationPageLink>? pageLinks,
    String? volume,
    String? sourceFile,
    ChatCitationPdf? pdf,
    String? openLabel,
  }) {
    return ChatCitation(
      label: label ?? this.label,
      title: title ?? this.title,
      body: body ?? this.body,
      pageNum: pageNum ?? this.pageNum,
      pageStart: pageStart ?? this.pageStart,
      pageEnd: pageEnd ?? this.pageEnd,
      pages: pages ?? this.pages,
      pageLinks: pageLinks ?? this.pageLinks,
      volume: volume ?? this.volume,
      sourceFile: sourceFile ?? this.sourceFile,
      pdf: pdf ?? this.pdf,
      openLabel: openLabel ?? this.openLabel,
    );
  }

  factory ChatCitation.fromJson(Map<String, dynamic> json) {
    final excerpt = (json['excerpt'] as String? ?? json['body'] as String? ?? '').trim();
    final quote = (json['quote'] as String? ?? '').trim();
    final body = excerpt.length >= quote.length ? excerpt : quote;
    final pdfRaw = json['pdf'];
    final pagesRaw = json['pages'];
    final linksRaw = json['pageLinks'];
    return ChatCitation(
      label: json['label'] as String? ?? json['title'] as String? ?? 'Nguồn',
      title: json['title'] as String? ?? '',
      body: body,
      pageNum: _asInt(json['pageNum']),
      pageStart: _asInt(json['pageStart']),
      pageEnd: _asInt(json['pageEnd']),
      pages: pagesRaw is List
          ? pagesRaw.map(_asInt).whereType<int>().toList()
          : const [],
      pageLinks: linksRaw is List
          ? linksRaw
              .whereType<Map<String, dynamic>>()
              .map(ChatCitationPageLink.fromJson)
              .toList()
          : const [],
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
        if (pages.isNotEmpty) 'pages': pages,
        if (pageLinks.isNotEmpty)
          'pageLinks': pageLinks.map((p) => p.toJson()).toList(),
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

/// One card per book — all cited pages become chips (tr.4 · tr.5 · tr.7).
List<ChatCitation> mergeCitationsByBook(List<ChatCitation> citations) {
  if (citations.length <= 1) return citations;

  String groupKey(ChatCitation c) {
    final file = (c.sourceFile ?? '').trim().toLowerCase();
    if (file.isNotEmpty) {
      return 'file:${file.replaceAll(RegExp(r'\.(txt|pdf)$', caseSensitive: false), '')}';
    }
    final title = (c.title.isNotEmpty ? c.title : c.label)
        .toLowerCase()
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    return 'title:${title.isEmpty ? 'unknown' : title}';
  }

  final groups = <String, List<ChatCitation>>{};
  final order = <String>[];
  for (final c in citations) {
    final key = groupKey(c);
    if (!groups.containsKey(key)) {
      groups[key] = [];
      order.add(key);
    }
    groups[key]!.add(c);
  }

  return [
    for (final key in order)
      () {
        final group = groups[key]!;
        final pageSet = <int>{};
        for (final c in group) {
          if (c.pageNum != null) pageSet.add(c.pageNum!);
          pageSet.addAll(c.pages);
          for (final link in c.pageLinks) {
            pageSet.add(link.printed);
          }
          final start = c.pageStart;
          final end = c.pageEnd;
          if (start != null && end != null && end >= start && end - start <= 8) {
            for (var p = start; p <= end; p++) {
              pageSet.add(p);
            }
          }
        }
        final pages = pageSet.toList()..sort();
        final primary = group.first;
        final pageStart = pages.isNotEmpty ? pages.first : primary.pageStart ?? primary.pageNum;
        final pageEnd = pages.isNotEmpty ? pages.last : primary.pageEnd ?? primary.pageNum;
        final longestBody = group
            .map((c) => c.body.trim())
            .where((b) => b.isNotEmpty)
            .fold<String>(primary.body, (a, b) => b.length > a.length ? b : a);
        final linkByPrinted = <int, ChatCitationPageLink>{};
        for (final c in group) {
          for (final link in c.pageLinks) {
            linkByPrinted[link.printed] = link;
          }
        }
        final pageLinks = [
          for (final p in pages)
            linkByPrinted[p] ??
                ChatCitationPageLink(
                  printed: p,
                  filePage: toPdfFilePage(primary.sourceFile, p),
                  openLabel: 'tr.$p',
                ),
        ];
        return primary.copyWith(
          body: longestBody,
          pages: pages,
          pageNum: primary.pageNum ?? pageStart,
          pageStart: pageStart,
          pageEnd: pageEnd,
          pageLinks: pageLinks.isNotEmpty ? pageLinks : primary.pageLinks,
        );
      }(),
  ];
}

class ChatConversation {
  const ChatConversation({
    required this.id,
    required this.title,
    required this.updatedAt,
    required this.messages,
    this.sourceFiles = const [],
  });

  final String id;
  final String title;
  final DateTime updatedAt;
  final List<ChatMessage> messages;
  /// Hard RAG book filter (`21.txt`, …). Empty = all books.
  final List<String> sourceFiles;

  factory ChatConversation.fromJson(Map<String, dynamic> json) {
    return ChatConversation(
      id: json['id'] as String,
      title: json['title'] as String,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      messages: (json['messages'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ChatMessage.fromJson)
          .toList(),
      sourceFiles: (json['sourceFiles'] as List<dynamic>? ?? [])
          .whereType<String>()
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'updatedAt': updatedAt.toIso8601String(),
        'messages': messages.map((m) => m.toJson()).toList(),
        'sourceFiles': sourceFiles,
      };

  ChatConversation copyWith({
    String? title,
    DateTime? updatedAt,
    List<ChatMessage>? messages,
    List<String>? sourceFiles,
  }) {
    return ChatConversation(
      id: id,
      title: title ?? this.title,
      updatedAt: updatedAt ?? this.updatedAt,
      messages: messages ?? this.messages,
      sourceFiles: sourceFiles ?? this.sourceFiles,
    );
  }
}

/// Book available for RAG hard-filter (`GET /rag/sources`).
class RagSourceBook {
  const RagSourceBook({
    required this.id,
    required this.title,
    required this.sourceFile,
    this.volume,
    this.sortOrder = 0,
  });

  final String id;
  final String title;
  final String sourceFile;
  final String? volume;
  final int sortOrder;

  factory RagSourceBook.fromJson(Map<String, dynamic> json) {
    return RagSourceBook(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      sourceFile: json['sourceFile'] as String? ?? '',
      volume: json['volume'] as String?,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }

  String get shortLabel {
    final full = displayTitle.trim();
    if (full.length <= 42) return full;
    return '${full.substring(0, 42)}…';
  }

  /// Unique label when several rows share the same base title (e.g. Quyển Thượng/Hạ).
  String get displayTitle {
    final t = title.trim();
    final v = volume?.trim();
    if (v == null || v.isEmpty) return t;
    if (t.toLowerCase().contains(v.toLowerCase())) return t;
    return '$t — $v';
  }
}
