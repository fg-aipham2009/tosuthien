import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../../books/data/books_repository.dart';
import '../../books/models/book_pdf.dart';
import '../../books/presentation/pdf_flip_reader_screen.dart';
import '../models/chat_models.dart';

class ChatMessageBubble extends StatelessWidget {
  const ChatMessageBubble({
    super.key,
    required this.message,
  });

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final isUser = message.role == ChatMessageRole.user;

    if (isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: colors.surfaceContainerHigh,
            borderRadius: BorderRadius.circular(20),
          ),
          child: SelectableText(
            message.content,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  height: 1.5,
                ),
          ),
        ),
      );
    }

    final rawContent = message.content.isEmpty && message.isStreaming
        ? '…'
        : message.content;
    // Main bubble must stay scripture-only (strip any leaked AI marker while streaming).
    final content = _scriptureOnly(rawContent);
    final aiText = message.aiInterpretation?.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 28,
              height: 28,
              margin: const EdgeInsets.only(top: 2, right: 12),
              decoration: BoxDecoration(
                gradient: AppTheme.mp3AccentGradient,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.auto_awesome,
                color: Colors.white,
                size: 16,
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (content.isNotEmpty) ...[
                    Text(
                      'Nguyên văn kinh sách',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: colors.primary,
                          ),
                    ),
                    const SizedBox(height: 6),
                    SelectableText(
                      content,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            height: 1.6,
                          ),
                    ),
                  ],
                  if (message.isStreaming)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: colors.primary,
                        ),
                      ),
                    ),
                  if (message.citations.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      'Kinh sách trích dẫn (${message.citations.length})',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: colors.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: 8),
                    ...message.citations.map(
                      (c) => _CitationCard(citation: c),
                    ),
                  ],
                  // Below citations only.
                  if (aiText != null && aiText.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _AiInterpretationBox(text: aiText),
                  ],
                  if (message.disclaimer != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      message.disclaimer!,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: colors.onSurfaceVariant,
                            fontStyle: FontStyle.italic,
                            height: 1.35,
                          ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

String _scriptureOnly(String content) {
  const marker = '【AI diễn giải】';
  final idx = content.indexOf(marker);
  if (idx < 0) return content.trim();
  return content.substring(0, idx).trim();
}

class _AiInterpretationBox extends StatelessWidget {
  const _AiInterpretationBox({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: colors.secondaryContainer.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: colors.outlineVariant.withValues(alpha: 0.7),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.psychology_alt_outlined,
                size: 18,
                color: colors.onSecondaryContainer,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'AI diễn giải',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colors.onSecondaryContainer,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Lời AI — nền từ câu hỏi & nguyên văn; có thể bổ sung kiến thức nền. Không phải kinh văn.',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.onSurfaceVariant,
                  fontStyle: FontStyle.italic,
                  height: 1.3,
                ),
          ),
          const SizedBox(height: 10),
          SelectableText(
            text,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  height: 1.55,
                  color: colors.onSurface,
                ),
          ),
        ],
      ),
    );
  }
}

class _CitationCard extends StatefulWidget {
  const _CitationCard({required this.citation});

  final ChatCitation citation;

  @override
  State<_CitationCard> createState() => _CitationCardState();
}

class _CitationCardState extends State<_CitationCard> {
  bool _opening = false;

  ChatCitation get citation => widget.citation;

  Future<void> _openPdf({int? filePage}) async {
    if (_opening || !citation.canOpenPdf) return;

    setState(() => _opening = true);
    final messenger = ScaffoldMessenger.of(context);
    final repository = BooksRepository();

    try {
      final page = filePage ??
          citation.openPage ??
          citation.pdf?.pageNum ??
          citation.tappablePages.firstOrNull?.filePage ??
          1;
      BookPdf? book;

      final pdf = citation.pdf;
      if (pdf != null && pdf.pdfFileId.isNotEmpty) {
        book = BookPdf(
          id: pdf.pdfFileId,
          slug: pdf.pdfSlug.isNotEmpty ? pdf.pdfSlug : pdf.pdfFileId,
          title: pdf.pdfTitle.isNotEmpty ? pdf.pdfTitle : citation.title,
          volume: citation.volume,
          author: 'Hòa thượng Thích Duy Lực',
          filename: _filenameFromUrl(pdf.pdfUrl),
          storagePath: _storagePathFromUrl(pdf.pdfUrl),
          publicUrl: pdf.pdfUrl,
        );
      } else {
        book = await repository.findBySourceFile(citation.sourceFile);
      }

      if (book == null) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text(
              'Chưa có PDF trên server. Chạy seed pdf_files và copy file vào data/pdf/.',
            ),
          ),
        );
        return;
      }

      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => PdfFlipReaderScreen(
            book: book!,
            initialPage: page,
            repository: repository,
            saveReadingProgress: false,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text('Không mở được PDF: $e')),
      );
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  static String _filenameFromUrl(String url) {
    final path = Uri.tryParse(url)?.path ?? url;
    final name = path.split('/').where((s) => s.isNotEmpty).lastOrNull ?? 'book.pdf';
    return name.endsWith('.pdf') ? name : '$name.pdf';
  }

  static String _storagePathFromUrl(String url) {
    final path = Uri.tryParse(url)?.path ?? url;
    const marker = '/files/';
    final i = path.indexOf(marker);
    if (i >= 0) return path.substring(i + marker.length);
    final name = _filenameFromUrl(url);
    return name.startsWith('pdf/') ? name : 'pdf/$name';
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final tappable = citation.canOpenPdf;
    final pageChips = citation.tappablePages;

    return Material(
      color: colors.surfaceContainerLow,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: colors.outlineVariant.withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.menu_book_outlined, size: 15, color: colors.primary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    citation.title.isEmpty ? citation.label : citation.title,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: colors.primary,
                        ),
                  ),
                ),
                if (_opening)
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: colors.primary,
                    ),
                  ),
              ],
            ),
            if (pageChips.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  for (var i = 0; i < pageChips.length; i++) ...[
                    if (i > 0)
                      Text(
                        ' · ',
                        style: Theme.of(context).textTheme.labelMedium?.copyWith(
                              color: colors.onSurfaceVariant,
                            ),
                      ),
                    InkWell(
                      onTap: tappable && !_opening
                          ? () => _openPdf(filePage: pageChips[i].filePage)
                          : null,
                      borderRadius: BorderRadius.circular(4),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 2,
                          vertical: 2,
                        ),
                        child: Text(
                          pageChips[i].openLabel,
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                color: tappable
                                    ? colors.primary
                                    : colors.onSurfaceVariant,
                                fontWeight: FontWeight.w600,
                                decoration: tappable
                                    ? TextDecoration.underline
                                    : TextDecoration.none,
                                decorationColor: colors.primary,
                              ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
            if (citation.body.isNotEmpty) ...[
              const SizedBox(height: 8),
              SelectableText(
                citation.body,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colors.onSurfaceVariant,
                      height: 1.45,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class ChatWelcome extends StatelessWidget {
  const ChatWelcome({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  gradient: AppTheme.mp3AccentGradient,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.auto_awesome, color: Colors.white, size: 28),
              ),
              const SizedBox(height: 20),
              Text(
                'Hỏi đáp kinh sách',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 10),
              Text(
                'Đặt câu hỏi về giáo lý, kinh sách Hoà thượng Thích Duy Lực.\n'
                'Câu trả lời kèm trích dẫn nguồn để bạn tự đối chiếu.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: colors.onSurfaceVariant,
                      height: 1.55,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
