import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../../core/widgets/loading_view.dart';
import '../../offline_books/state/offline_books_scope.dart';
import '../data/books_repository.dart';
import '../models/book_pdf.dart';

/// PDF reader powered by [pdfrx] [PdfViewer]: zoom, pan, scroll, text selection,
/// search, and page navigation (no flipbook animation).
class PdfFlipReaderScreen extends StatefulWidget {
  const PdfFlipReaderScreen({
    super.key,
    required this.book,
    this.initialPage = 1,
    this.repository,
    /// When true (Kinh sách tab), fetch last saved page from server on open.
    this.resumeFromServer = false,
    /// When false (opened from AI citation), do not write reading_progress.
    this.saveReadingProgress = true,
  });

  final BookPdf book;
  final int initialPage;
  final BooksRepository? repository;
  final bool resumeFromServer;
  final bool saveReadingProgress;

  @override
  State<PdfFlipReaderScreen> createState() => _PdfFlipReaderScreenState();
}

class _PdfFlipReaderScreenState extends State<PdfFlipReaderScreen> {
  late final BooksRepository _repository;
  late final bool _ownsRepository;
  final PdfViewerController _controller = PdfViewerController();
  PdfTextSearcher? _textSearcher;
  final TextEditingController _searchController = TextEditingController();
  bool _showSearch = false;
  int _currentPage = 1;
  int _pageCount = 0;
  int _initialPage = 1;
  Timer? _saveDebounce;
  int? _pendingSavePage;
  Future<String>? _openUrlFuture;
  bool _resumeApplied = false;

  @override
  void initState() {
    super.initState();
    _ownsRepository = widget.repository == null;
    _repository = widget.repository ?? BooksRepository();
    _initialPage = widget.initialPage.clamp(1, 99999);
    _currentPage = _initialPage;
    if (widget.resumeFromServer) {
      _applyServerLastPage();
    }
  }

  Future<void> _applyServerLastPage() async {
    final fresh = await _repository.fetchBookById(widget.book.id);
    if (!mounted || fresh == null) return;
    final page = fresh.lastPage;
    if (page == null || page < 1) return;
    if (_resumeApplied) return;
    _resumeApplied = true;
    setState(() {
      _initialPage = page;
      _currentPage = page;
    });
    if (_controller.isReady) {
      unawaited(_controller.goToPage(pageNumber: page));
    }
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
    if (widget.saveReadingProgress) {
      final pending = _pendingSavePage;
      if (pending != null) {
        unawaited(
          _repository.saveReadingProgress(
            pdfFileId: widget.book.id,
            lastPage: pending,
          ),
        );
      }
    }
    _textSearcher?.dispose();
    _searchController.dispose();
    if (_ownsRepository) {
      _repository.dispose();
    }
    super.dispose();
  }

  void _scheduleSave(int page) {
    if (!widget.saveReadingProgress) return;
    _pendingSavePage = page;
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(milliseconds: 600), () {
      _pendingSavePage = null;
      _repository.saveReadingProgress(
        pdfFileId: widget.book.id,
        lastPage: page,
      );
    });
  }

  void _onPageChanged(int? pageNumber) {
    if (pageNumber == null || pageNumber < 1) return;
    if (pageNumber == _currentPage) return;
    setState(() => _currentPage = pageNumber);
    _scheduleSave(pageNumber);
  }

  Future<void> _goTo(int page) async {
    if (_pageCount <= 0 || !_controller.isReady) return;
    final target = page.clamp(1, _pageCount);
    await _controller.goToPage(pageNumber: target);
    setState(() => _currentPage = target);
    _scheduleSave(target);
  }

  void _onViewerReady(PdfDocument document, PdfViewerController controller) {
    _textSearcher?.dispose();
    _textSearcher = PdfTextSearcher(controller)..addListener(_onSearchChanged);
    setState(() {
      _pageCount = document.pages.length;
      if (_currentPage > _pageCount) {
        _currentPage = _pageCount.clamp(1, _pageCount);
      }
    });
  }

  void _onSearchChanged() {
    if (mounted) setState(() {});
  }

  void _runSearch(String query) {
    final searcher = _textSearcher;
    if (searcher == null) return;
    final q = query.trim();
    if (q.isEmpty) {
      searcher.resetTextSearch();
      setState(() {});
      return;
    }
    searcher.startTextSearch(q, caseInsensitive: true, goToFirstMatch: true);
  }

  Widget _buildSearchBar(ColorScheme colors) {
    final searcher = _textSearcher;
    final matchLabel = searcher == null || !searcher.hasMatches
        ? ''
        : '${(searcher.currentIndex ?? 0) + 1}/${searcher.matches.length}';

    return Material(
      color: colors.surfaceContainerHighest,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  autofocus: true,
                  decoration: const InputDecoration(
                    hintText: 'Tìm trong sách…',
                    isDense: true,
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                  ),
                  textInputAction: TextInputAction.search,
                  onSubmitted: _runSearch,
                  onChanged: (v) {
                    if (v.trim().isEmpty) _runSearch('');
                  },
                ),
              ),
              const SizedBox(width: 4),
              if (matchLabel.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Text(matchLabel, style: Theme.of(context).textTheme.labelMedium),
                ),
              IconButton(
                tooltip: 'Kết quả trước',
                onPressed: searcher?.hasMatches == true
                    ? () => searcher!.goToPrevMatch()
                    : null,
                icon: const Icon(Icons.keyboard_arrow_up),
              ),
              IconButton(
                tooltip: 'Kết quả sau',
                onPressed: searcher?.hasMatches == true
                    ? () => searcher!.goToNextMatch()
                    : null,
                icon: const Icon(Icons.keyboard_arrow_down),
              ),
              IconButton(
                tooltip: 'Tìm',
                onPressed: () => _runSearch(_searchController.text),
                icon: const Icon(Icons.search),
              ),
              IconButton(
                tooltip: 'Đóng',
                onPressed: () {
                  _textSearcher?.resetTextSearch();
                  _searchController.clear();
                  setState(() => _showSearch = false);
                },
                icon: const Icon(Icons.close),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomBar(ColorScheme colors) {
    if (_pageCount <= 0) return const SizedBox.shrink();
    final page = _currentPage.clamp(1, _pageCount);
    return Material(
      color: colors.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              IconButton.filledTonal(
                tooltip: 'Trang trước',
                onPressed: page > 1 ? () => _goTo(page - 1) : null,
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              Expanded(
                child: Slider(
                  value: (page - 1).toDouble(),
                  min: 0,
                  max: (_pageCount - 1).toDouble(),
                  divisions: _pageCount > 1 ? _pageCount - 1 : 1,
                  label: 'tr.$page',
                  onChanged: (v) => _goTo(v.round() + 1),
                ),
              ),
              IconButton.filledTonal(
                tooltip: 'Trang sau',
                onPressed: page < _pageCount ? () => _goTo(page + 1) : null,
                icon: const Icon(Icons.chevron_right_rounded),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _paintSearchMatches(ui.Canvas canvas, Rect pageRect, PdfPage page) {
    _textSearcher?.pageTextMatchPaintCallback(canvas, pageRect, page);
  }

  PdfViewerParams _viewerParams(ColorScheme colors) {
    return PdfViewerParams(
      backgroundColor: const Color(0xFF3E2723),
      margin: 8,
      panEnabled: true,
      scaleEnabled: true,
      enableKeyboardNavigation: true,
      textSelectionParams: const PdfTextSelectionParams(enabled: true),
      pagePaintCallbacks: [_paintSearchMatches],
      onPageChanged: _onPageChanged,
      onViewerReady: _onViewerReady,
      loadingBannerBuilder: (context, bytesDownloaded, totalBytes) {
        return const LoadingView();
      },
      errorBannerBuilder: (context, error, stackTrace, documentRef) {
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Không mở được PDF.\n$error',
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.error),
            ),
          ),
        );
      },
      viewerOverlayBuilder: (context, size, handleLinkTap) => [
        PdfViewerScrollThumb(
          controller: _controller,
          orientation: ScrollbarOrientation.right,
          thumbSize: const Size(25, 40),
          margin: 2,
        ),
        PdfViewerScrollThumb(
          controller: _controller,
          orientation: ScrollbarOrientation.bottom,
          thumbSize: const Size(40, 25),
          margin: 2,
        ),
      ],
    );
  }

  Widget _buildViewer(String openUrl, ColorScheme colors) {
    final uri = Uri.parse(openUrl);
    final isFile = uri.scheme == 'file';
    final params = _viewerParams(colors);
    final initial = _initialPage;

    if (isFile) {
      return PdfViewer.file(
        uri.toFilePath(),
        controller: _controller,
        params: params,
        initialPageNumber: initial,
        useProgressiveLoading: true,
      );
    }

    return PdfViewer.uri(
      uri,
      controller: _controller,
      params: params,
      initialPageNumber: initial,
      useProgressiveLoading: true,
      preferRangeAccess: !kIsWeb,
    );
  }

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
          IconButton(
            tooltip: 'Tìm kiếm',
            onPressed: () => setState(() => _showSearch = !_showSearch),
            icon: const Icon(Icons.search),
          ),
          if (_pageCount > 0)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Text(
                  '$_currentPage / $_pageCount',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          if (_showSearch) _buildSearchBar(colors),
          Expanded(
            child: FutureBuilder<String>(
              future: _openUrlFuture,
              builder: (context, snap) {
                if (!snap.hasData) return const LoadingView();
                return _buildViewer(snap.data!, colors);
              },
            ),
          ),
          _buildBottomBar(colors),
        ],
      ),
    );
  }
}
