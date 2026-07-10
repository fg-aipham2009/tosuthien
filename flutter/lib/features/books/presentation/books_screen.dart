import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../../core/widgets/refreshable_async_body.dart';
import '../data/books_repository.dart';
import '../models/book_pdf.dart';
import '../presentation/pdf_flip_reader_screen.dart';
import '../widgets/book_tile.dart';

class BooksScreen extends StatefulWidget {
  const BooksScreen({super.key});

  @override
  State<BooksScreen> createState() => _BooksScreenState();
}

class _BooksScreenState extends State<BooksScreen> {
  late final BooksRepository _repository;
  late Future<List<BookPdf>> _future;

  @override
  void initState() {
    super.initState();
    _repository = BooksRepository();
    _future = _repository.fetchBooks();
  }

  @override
  void dispose() {
    _repository.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() => _future = _repository.fetchBooks());
    await _future;
  }

  void _openBook(BookPdf book) {
    final startPage = book.lastPage ?? 1;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PdfFlipReaderScreen(
          book: book,
          initialPage: startPage,
          repository: _repository,
          resumeFromServer: true,
        ),
      ),
    ).then((_) => _reload());
  }

  @override
  Widget build(BuildContext context) {
    return RefreshableAsyncBody<List<BookPdf>>(
      future: _future,
      onRefresh: _reload,
      builder: (context, books) {
        if (books.isEmpty) {
          return const EmptyStateView(
            icon: Icons.menu_book_outlined,
            message:
                'Chưa có kinh sách.\nUpload PDF vào data/pdf/ và seed pdf_files trên server.',
          );
        }

        return CustomScrollView(
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
                      'Lật trang như sách giấy — chạm mép hoặc vuốt ngang để đọc.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.white.withValues(alpha: 0.9),
                            height: 1.4,
                          ),
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              sliver: SliverList.separated(
                itemCount: books.length,
                separatorBuilder: (_, __) => const SizedBox(height: 0),
                itemBuilder: (context, index) {
                  final book = books[index];
                  return BookTile(
                    book: book,
                    onTap: () => _openBook(book),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
