import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../../core/widgets/loading_view.dart';
import '../data/books_repository.dart';
import '../models/book_pdf.dart';
import '../models/text_book.dart';
import 'pdf_flip_reader_screen.dart';
import 'text_book_reader_screen.dart';
import '../widgets/book_tile.dart';

enum _BooksMode { banGoc, docChu }

class BooksScreen extends StatefulWidget {
  const BooksScreen({super.key});

  @override
  State<BooksScreen> createState() => _BooksScreenState();
}

class _BooksScreenState extends State<BooksScreen> {
  late final BooksRepository _repository;
  late Future<List<BookPdf>> _pdfFuture;
  late Future<List<TextBook>> _textFuture;
  _BooksMode _mode = _BooksMode.banGoc;

  @override
  void initState() {
    super.initState();
    _repository = BooksRepository();
    _pdfFuture = _repository.fetchBooks();
    _textFuture = _repository.fetchTextBooks();
  }

  @override
  void dispose() {
    _repository.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() {
      _pdfFuture = _repository.fetchBooks();
      _textFuture = _repository.fetchTextBooks();
    });
    await Future.wait([_pdfFuture, _textFuture]);
  }

  void _openPdf(BookPdf book) {
    final startPage = book.lastPage ?? 1;
    Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            builder: (_) => PdfFlipReaderScreen(
              book: book,
              initialPage: startPage,
              repository: _repository,
              resumeFromServer: true,
            ),
          ),
        )
        .then((_) => _reload());
  }

  void _openText(TextBook book) {
    final firstContent = (book.blankPages + 1).clamp(1, book.pageCount.clamp(1, 100000));
    final saved = book.lastPage;
    final startPage =
        (saved != null && saved >= firstContent) ? saved : firstContent;
    Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            builder: (_) => TextBookReaderScreen(
              book: book,
              initialPage: startPage,
              repository: _repository,
            ),
          ),
        )
        .then((_) => _reload());
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _reload,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: AppTheme.mp3HeaderGradient,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Kinh sách',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _mode == _BooksMode.banGoc
                        ? 'PDF gốc — giữ đúng trang sách in, phóng to / tìm chữ.'
                        : 'Đọc chữ — từng trang rõ ràng, chỉnh cỡ chữ, mở nhanh.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.white.withValues(alpha: 0.9),
                          height: 1.4,
                        ),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: SegmentedButton<_BooksMode>(
                segments: const [
                  ButtonSegment(
                    value: _BooksMode.banGoc,
                    label: Text('Bản gốc'),
                    icon: Icon(Icons.picture_as_pdf_outlined, size: 18),
                  ),
                  ButtonSegment(
                    value: _BooksMode.docChu,
                    label: Text('Đọc chữ'),
                    icon: Icon(Icons.menu_book_outlined, size: 18),
                  ),
                ],
                selected: {_mode},
                onSelectionChanged: (s) {
                  setState(() => _mode = s.first);
                },
              ),
            ),
          ),
          if (_mode == _BooksMode.banGoc)
            _PdfBooksSliver(future: _pdfFuture, onOpen: _openPdf)
          else
            _TextBooksSliver(future: _textFuture, onOpen: _openText),
        ],
      ),
    );
  }
}

class _PdfBooksSliver extends StatelessWidget {
  const _PdfBooksSliver({
    required this.future,
    required this.onOpen,
  });

  final Future<List<BookPdf>> future;
  final ValueChanged<BookPdf> onOpen;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<BookPdf>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const SliverFillRemaining(child: LoadingView());
        }
        if (snap.hasError) {
          return SliverFillRemaining(
            child: EmptyStateView(
              icon: Icons.error_outline,
              message: 'Không tải được Bản gốc:\n${snap.error}',
            ),
          );
        }
        final books = snap.data ?? const <BookPdf>[];
        if (books.isEmpty) {
          return const SliverFillRemaining(
            child: EmptyStateView(
              icon: Icons.menu_book_outlined,
              message:
                  'Chưa có PDF.\nUpload vào data/pdf/ và seed pdf_files trên server.',
            ),
          );
        }
        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          sliver: SliverList.builder(
            itemCount: books.length,
            itemBuilder: (context, index) {
              final book = books[index];
              return BookTile(book: book, onTap: () => onOpen(book));
            },
          ),
        );
      },
    );
  }
}

class _TextBooksSliver extends StatelessWidget {
  const _TextBooksSliver({
    required this.future,
    required this.onOpen,
  });

  final Future<List<TextBook>> future;
  final ValueChanged<TextBook> onOpen;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<TextBook>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const SliverFillRemaining(child: LoadingView());
        }
        if (snap.hasError) {
          return SliverFillRemaining(
            child: EmptyStateView(
              icon: Icons.error_outline,
              message: 'Không tải được Đọc chữ:\n${snap.error}',
            ),
          );
        }
        final books = snap.data ?? const <TextBook>[];
        if (books.isEmpty) {
          return const SliverFillRemaining(
            child: EmptyStateView(
              icon: Icons.chrome_reader_mode_outlined,
              message:
                  'Chưa có sách chữ.\nChạy normalize_book_text.py rồi đặt text/books trên server.',
            ),
          );
        }
        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          sliver: SliverList.builder(
            itemCount: books.length,
            itemBuilder: (context, index) {
              final book = books[index];
              return _TextBookTile(book: book, onTap: () => onOpen(book));
            },
          ),
        );
      },
    );
  }
}

class _TextBookTile extends StatelessWidget {
  const _TextBookTile({required this.book, required this.onTap});

  final TextBook book;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: colors.outlineVariant.withValues(alpha: 0.45)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 52,
                  height: 68,
                  child: book.coverImageUrl != null && book.coverImageUrl!.isNotEmpty
                      ? Image.network(
                          book.coverImageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: AppTheme.mp3AccentGradient,
                            ),
                            child: const Icon(Icons.article_rounded, color: Colors.white),
                          ),
                        )
                      : DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: AppTheme.mp3AccentGradient,
                          ),
                          child: const Icon(Icons.article_rounded, color: Colors.white),
                        ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      book.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            height: 1.3,
                          ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${book.author} · ${book.pageCount} trang',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colors.onSurfaceVariant,
                          ),
                    ),
                    if (book.lastPage != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Đọc dở · tr.${book.lastPage}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: colors.primary,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: colors.outline),
            ],
          ),
        ),
      ),
    );
  }
}
