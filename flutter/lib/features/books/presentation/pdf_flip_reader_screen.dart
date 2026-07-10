import 'dart:async';

import 'package:flutter/material.dart';
import 'package:page_flip/page_flip.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../../core/widgets/loading_view.dart';
import '../../offline_books/state/offline_books_scope.dart';
import '../data/books_repository.dart';
import '../models/book_pdf.dart';
import '../widgets/pdf_flip_page.dart';

class PdfFlipReaderScreen extends StatefulWidget {
  const PdfFlipReaderScreen({
    super.key,
    required this.book,
    this.initialPage = 1,
    this.repository,
  });

  final BookPdf book;
  final int initialPage;
  final BooksRepository? repository;

  @override
  State<PdfFlipReaderScreen> createState() => _PdfFlipReaderScreenState();
}

class _PdfFlipReaderScreenState extends State<PdfFlipReaderScreen> {
  late final BooksRepository _repository;
  final _flipController = PageFlipController();
  int _currentIndex = 0;
  int _pageCount = 0;
  Timer? _saveDebounce;
  Future<String>? _openUrlFuture;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? BooksRepository();
    _currentIndex = (widget.initialPage - 1).clamp(0, 9999);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _openUrlFuture ??= _resolveOpenUrl();
  }

  Future<String> _resolveOpenUrl() async {
    final offline = OfflineBooksScope.maybeOf(context);
    if (offline != null) {
      return offline.openUrlFor(widget.book);
    }
    return widget.book.pdfUrl;
  }

  @override
  void dispose() {
    _saveDebounce?.cancel();
    if (widget.repository == null) {
      _repository.dispose();
    }
    super.dispose();
  }

  void _onPageChanged(int index) {
    setState(() => _currentIndex = index);
    _scheduleSave(index + 1);
  }

  void _scheduleSave(int page) {
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(milliseconds: 600), () {
      _repository.saveReadingProgress(
        pdfFileId: widget.book.id,
        lastPage: page,
      );
    });
  }

  void _goPrev() => _flipController.previousPage();

  void _goNext() => _flipController.nextPage();

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: const Color(0xFF3E2723),
      appBar: AppBar(
        backgroundColor: colors.surface,
        foregroundColor: colors.onSurface,
        title: Text(
          widget.book.displayTitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          if (_pageCount > 0)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Text(
                  '${_currentIndex + 1} / $_pageCount',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
            ),
        ],
      ),
      body: FutureBuilder<String>(
        future: _openUrlFuture,
        builder: (context, snap) {
          if (!snap.hasData) {
            return const LoadingView();
          }
          return PdfDocumentViewBuilder.uri(
            Uri.parse(snap.data!),
            useProgressiveLoading: true,
            preferRangeAccess: true,
            loadingBuilder: (context) => const LoadingView(),
            errorBuilder: (context, error, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Không mở được PDF.\n$error',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: colors.error),
                ),
              ),
            ),
            builder: (context, document) {
              if (document == null) {
                return const LoadingView();
              }

              final count = document.pages.length;
              if (count == 0) {
                return const Center(child: Text('PDF không có trang.'));
              }

              if (_pageCount != count) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) setState(() => _pageCount = count);
                });
              }

              final startIndex = widget.initialPage.clamp(1, count) - 1;

              return Column(
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                      child: PageFlipWidget(
                        key: ValueKey('${widget.book.id}-$count'),
                        controller: _flipController,
                        initialIndex: startIndex,
                        backgroundColor: const Color(0xFFFFF8E7),
                        onPageFlipped: _onPageChanged,
                        children: List.generate(
                          count,
                          (i) => PdfFlipPage(
                            document: document,
                            pageNumber: i + 1,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Material(
                    color: colors.surface,
                    child: SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        child: Row(
                          children: [
                            IconButton.filledTonal(
                              tooltip: 'Trang trước',
                              onPressed: _currentIndex > 0 ? _goPrev : null,
                              icon: const Icon(Icons.chevron_left_rounded),
                            ),
                            Expanded(
                              child: Slider(
                                value: _currentIndex
                                    .clamp(0, count - 1)
                                    .toDouble(),
                                min: 0,
                                max: (count - 1).toDouble(),
                                divisions: count > 1 ? count - 1 : 1,
                                label: 'tr.${_currentIndex + 1}',
                                onChanged: (v) {
                                  final idx = v.round();
                                  _flipController.goToPage(idx);
                                  _onPageChanged(idx);
                                },
                              ),
                            ),
                            IconButton.filledTonal(
                              tooltip: 'Trang sau',
                              onPressed:
                                  _currentIndex < count - 1 ? _goNext : null,
                              icon: const Icon(Icons.chevron_right_rounded),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
