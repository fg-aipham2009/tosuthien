import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:page_flip/page_flip.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../../core/widgets/loading_view.dart';
import '../../offline_books/state/offline_books_scope.dart';
import '../data/books_repository.dart';
import '../models/book_pdf.dart';
import '../widgets/pdf_flip_page.dart';

/// Flipbook reader: [pdfrx] renders pages, [page_flip] animates turns on mobile.
///
/// Web uses a single-page navigator (no [PageFlipWidget] / [PageView]) because
/// `RepaintBoundary.toImage` and heavy adjacent-page builds are unreliable with
/// PDFium WASM. Mobile keeps a sliding window so [PageFlipWidget] never holds
/// hundreds of [AnimationController]s.
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
  static const int _windowSize = 5;
  static const int _edgePrefetch = 1;

  late final BooksRepository _repository;
  late final bool _ownsRepository;
  final FocusNode _focusNode = FocusNode();
  PageFlipController _flipController = PageFlipController();
  int _currentIndex = 0;
  int _pageCount = 0;
  int _windowStart = 0;
  int _flipEpoch = 0;
  Timer? _saveDebounce;
  int? _pendingSavePage;
  Future<String>? _openUrlFuture;
  bool _resumeApplied = false;

  @override
  void initState() {
    super.initState();
    _ownsRepository = widget.repository == null;
    _repository = widget.repository ?? BooksRepository();
    _currentIndex = (widget.initialPage - 1).clamp(0, 9999);
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
      _currentIndex = (page - 1).clamp(0, _pageCount > 0 ? _pageCount - 1 : 9999);
      _windowStart = 0;
      _flipEpoch++;
    });
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
    _clearFlipCache();
    _focusNode.dispose();
    // Do not close a shared client owned by BooksScreen / caller.
    if (_ownsRepository) {
      _repository.dispose();
    }
    super.dispose();
  }

  void _clearFlipCache() {
    for (final image in imageData.values) {
      image?.dispose();
    }
    imageData.clear();
  }

  int get _windowLength {
    if (_pageCount <= 0) return 0;
    return (_windowSize).clamp(1, _pageCount);
  }

  int get _localIndex =>
      (_currentIndex - _windowStart).clamp(0, _windowLength - 1);

  void _syncWindow({required bool remount}) {
    if (_pageCount <= 0) return;
    final len = _windowLength;
    final half = len ~/ 2;
    var start = (_currentIndex - half).clamp(0, _pageCount - len);
    final nearStart = _currentIndex <= _windowStart + _edgePrefetch;
    final nearEnd = _currentIndex >= _windowStart + len - 1 - _edgePrefetch;
    final outOfWindow =
        _currentIndex < _windowStart || _currentIndex >= _windowStart + len;

    if (!outOfWindow && !nearStart && !nearEnd && !remount) {
      return;
    }
    if (start == _windowStart && !remount && !outOfWindow) {
      if (nearEnd && _windowStart + len < _pageCount) {
        start = (_currentIndex - half).clamp(0, _pageCount - len);
      } else if (nearStart && _windowStart > 0) {
        start = (_currentIndex - half).clamp(0, _pageCount - len);
      } else if (!outOfWindow) {
        return;
      }
    }
    if (start == _windowStart && !remount) return;

    _clearFlipCache();
    setState(() {
      _windowStart = start;
      _flipController = PageFlipController();
      _flipEpoch++;
    });
  }

  void _onPageChanged(int localIndex) {
    final absolute = (_windowStart + localIndex).clamp(0, _pageCount - 1);
    setState(() => _currentIndex = absolute);
    _scheduleSave(absolute + 1);
    _syncWindow(remount: false);
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

  void _goPrev() {
    if (_currentIndex <= 0) return;
    if (kIsWeb) {
      _jumpTo(_currentIndex - 1);
      return;
    }
    if (_localIndex > 0) {
      _flipController.previousPage();
      return;
    }
    setState(() => _currentIndex--);
    _scheduleSave(_currentIndex + 1);
    _syncWindow(remount: true);
  }

  void _goNext() {
    if (_currentIndex >= _pageCount - 1) return;
    if (kIsWeb) {
      _jumpTo(_currentIndex + 1);
      return;
    }
    if (_localIndex < _windowLength - 1) {
      _flipController.nextPage();
      return;
    }
    setState(() => _currentIndex++);
    _scheduleSave(_currentIndex + 1);
    _syncWindow(remount: true);
  }

  void _jumpTo(int absoluteIndex) {
    if (_pageCount <= 0) return;
    final idx = absoluteIndex.clamp(0, _pageCount - 1);
    if (idx == _currentIndex) return;
    setState(() => _currentIndex = idx);
    _scheduleSave(idx + 1);
    if (!kIsWeb) {
      _syncWindow(remount: true);
    }
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowLeft ||
        event.logicalKey == LogicalKeyboardKey.pageUp) {
      _goPrev();
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowRight ||
        event.logicalKey == LogicalKeyboardKey.pageDown ||
        event.logicalKey == LogicalKeyboardKey.space) {
      _goNext();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  Widget _buildBottomBar(int count, ColorScheme colors) {
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
                onPressed: _currentIndex > 0 ? _goPrev : null,
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              Expanded(
                child: Slider(
                  value: _currentIndex.clamp(0, count - 1).toDouble(),
                  min: 0,
                  max: (count - 1).toDouble(),
                  divisions: count > 1 ? count - 1 : 1,
                  label: 'tr.${_currentIndex + 1}',
                  onChanged: (v) => _jumpTo(v.round()),
                ),
              ),
              IconButton.filledTonal(
                tooltip: 'Trang sau',
                onPressed: _currentIndex < count - 1 ? _goNext : null,
                icon: const Icon(Icons.chevron_right_rounded),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Web: one page at a time + swipe / click edges. Avoids PageView rebuild storms.
  Widget _buildWebReader(PdfDocument document, int count) {
    final index = _currentIndex.clamp(0, count - 1);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onHorizontalDragEnd: (details) {
        final vx = details.primaryVelocity ?? 0;
        if (vx < -200) {
          _goNext();
        } else if (vx > 200) {
          _goPrev();
        }
      },
      child: Stack(
        fit: StackFit.expand,
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            switchInCurve: Curves.easeOut,
            switchOutCurve: Curves.easeIn,
            child: KeyedSubtree(
              key: ValueKey('web-page-$index'),
              child: PdfFlipPage(
                document: document,
                pageNumber: index + 1,
              ),
            ),
          ),
          // Large invisible hit targets so buttons aren't the only way to turn.
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            width: 56,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _currentIndex > 0 ? _goPrev : null,
                overlayColor: WidgetStatePropertyAll(
                  Colors.white.withValues(alpha: 0.06),
                ),
              ),
            ),
          ),
          Positioned(
            right: 0,
            top: 0,
            bottom: 0,
            width: 56,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _currentIndex < count - 1 ? _goNext : null,
                overlayColor: WidgetStatePropertyAll(
                  Colors.white.withValues(alpha: 0.06),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMobileFlipbook(
    PdfDocument document,
    int count,
    int start,
    int end,
    int localStart,
  ) {
    return PageFlipWidget(
      key: ValueKey(
        '${widget.book.id}-$count-$_flipEpoch-$start-$end',
      ),
      controller: _flipController,
      initialIndex: localStart,
      backgroundColor: const Color(0xFFFFF8E7),
      onPageFlipped: _onPageChanged,
      children: [
        for (var i = start; i < end; i++)
          PdfFlipPage(
            document: document,
            pageNumber: i + 1,
          ),
      ],
    );
  }

  Widget _documentBuilder(BuildContext context, String openUrl) {
    final colors = Theme.of(context).colorScheme;
    final uri = Uri.parse(openUrl);
    final isFile = uri.scheme == 'file';

    Widget buildFlip(PdfDocument? document) {
      if (document == null) return const LoadingView();

      final count = document.pages.length;
      if (count == 0) {
        return const Center(child: Text('PDF không có trang.'));
      }

      if (_pageCount != count) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          setState(() {
            _pageCount = count;
            _currentIndex = _currentIndex.clamp(0, count - 1);
            if (!kIsWeb) {
              final len = _windowSize.clamp(1, count);
              final half = len ~/ 2;
              _windowStart = (_currentIndex - half).clamp(0, count - len);
            }
          });
        });
        return const LoadingView();
      }

      if (kIsWeb) {
        return Focus(
          focusNode: _focusNode,
          autofocus: true,
          onKeyEvent: _onKey,
          child: Column(
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                  child: _buildWebReader(document, count),
                ),
              ),
              _buildBottomBar(count, colors),
            ],
          ),
        );
      }

      final start = _windowStart.clamp(0, count - 1);
      final end = (start + _windowLength).clamp(1, count);
      final localStart = _localIndex.clamp(0, end - start - 1);

      return Column(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: _buildMobileFlipbook(
                document,
                count,
                start,
                end,
                localStart,
              ),
            ),
          ),
          _buildBottomBar(count, colors),
        ],
      );
    }

    if (isFile) {
      return PdfDocumentViewBuilder.file(
        uri.toFilePath(),
        useProgressiveLoading: true,
        loadingBuilder: (context) => const LoadingView(),
        errorBuilder: (context, error, _) => _errorView(colors, error),
        builder: (context, document) => buildFlip(document),
      );
    }

    return PdfDocumentViewBuilder.uri(
      uri,
      useProgressiveLoading: true,
      preferRangeAccess: !kIsWeb,
      loadingBuilder: (context) => const LoadingView(),
      errorBuilder: (context, error, _) => _errorView(colors, error),
      builder: (context, document) => buildFlip(document),
    );
  }

  Widget _errorView(ColorScheme colors, Object error) {
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
          if (!snap.hasData) return const LoadingView();
          return _documentBuilder(context, snap.data!);
        },
      ),
    );
  }
}
