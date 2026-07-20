import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../app/theme.dart';
import '../data/books_repository.dart';
import '../models/text_book.dart';

enum _ReadingTheme { light, sepia, dark }

const _bgAsset = 'assets/images/text_reader_bg_v4.png';

/// Text-only reader — zoom, fullscreen, tap to show/hide controls.
class TextBookReaderScreen extends StatefulWidget {
  const TextBookReaderScreen({
    super.key,
    required this.book,
    this.initialPage = 1,
    this.repository,
  });

  final TextBook book;
  final int initialPage;
  final BooksRepository? repository;

  @override
  State<TextBookReaderScreen> createState() => _TextBookReaderScreenState();
}

class _TextBookReaderScreenState extends State<TextBookReaderScreen> {
  static const _windowSize = 24;
  static const _prefetchEdge = 6;
  static const _prefsPagePrefix = 'text_book_page_';
  static const _prefsFontPrefix = 'text_book_font_';
  static const _prefsThemePrefix = 'text_book_theme_';

  late final BooksRepository _repository;
  late final bool _ownsRepository;
  late final PageController _pageController;
  late final int _pageCount;

  final Map<int, TextBookPage> _cache = {};
  final Set<int> _loadingRanges = {};

  double _fontSize = 18;
  static const _lineHeight = 1.7;
  _ReadingTheme _theme = _ReadingTheme.sepia;
  int _currentPage = 1;
  bool _booting = true;
  String? _bootError;
  bool _chromeVisible = true;
  bool _fullscreen = false;
  Timer? _saveDebounce;
  double _pinchBaseFont = 18;
  bool _settingsOpen = false;
  bool _jumpOpen = false;
  String _jumpText = '';

  @override
  void initState() {
    super.initState();
    _ownsRepository = widget.repository == null;
    _repository = widget.repository ?? BooksRepository();
    _pageCount = widget.book.pageCount.clamp(1, 100000);
    _currentPage = widget.initialPage.clamp(1, _pageCount);
    _pageController = PageController(initialPage: _currentPage - 1);
    _boot();
  }

  Future<void> _boot() async {
    final prefs = await SharedPreferences.getInstance();
    final savedFont = prefs.getDouble('$_prefsFontPrefix${widget.book.id}');
    final savedTheme = prefs.getInt('$_prefsThemePrefix${widget.book.id}');
    if (savedFont != null) _fontSize = savedFont.clamp(14, 36);
    if (savedTheme != null && savedTheme < _ReadingTheme.values.length) {
      _theme = _ReadingTheme.values[savedTheme];
    }
    _pinchBaseFont = _fontSize;

    final localPage = prefs.getInt('$_prefsPagePrefix${widget.book.id}');
    var start = widget.initialPage;
    if (widget.book.lastPage != null && widget.book.lastPage! >= 1) {
      start = widget.book.lastPage!;
    } else if (localPage != null && localPage >= 1) {
      start = localPage;
    }
    start = start.clamp(1, _pageCount);

    try {
      await _ensurePagesAround(start);
      if (!mounted) return;
      setState(() {
        _currentPage = start;
        _booting = false;
      });
      if (_pageController.hasClients) {
        _pageController.jumpToPage(start - 1);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _booting = false;
        _bootError = '$e';
      });
    }
  }

  @override
  void dispose() {
    _saveDebounce?.cancel();
    _pageController.dispose();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    if (_ownsRepository) _repository.dispose();
    super.dispose();
  }

  _ReadingPalette get _palette => _ReadingPalette.forTheme(_theme);

  Future<void> _persistPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble('$_prefsFontPrefix${widget.book.id}', _fontSize);
    await prefs.setInt('$_prefsThemePrefix${widget.book.id}', _theme.index);
  }

  void _setFontSize(double size) {
    setState(() {
      _fontSize = size.clamp(14, 36);
      _pinchBaseFont = _fontSize;
    });
    unawaited(_persistPrefs());
  }

  void _toggleChrome() {
    setState(() => _chromeVisible = !_chromeVisible);
  }

  Future<void> _toggleFullscreen() async {
    final next = !_fullscreen;
    setState(() {
      _fullscreen = next;
      if (next) _chromeVisible = false;
    });
    if (next) {
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      setState(() => _chromeVisible = true);
    }
  }

  Future<void> _ensurePagesAround(int page) async {
    final from = (page - _windowSize ~/ 2).clamp(1, _pageCount);
    final to = (from + _windowSize - 1).clamp(1, _pageCount);
    await _loadRange(from, to);
  }

  Future<void> _loadRange(int from, int to) async {
    final missing = <int>[];
    for (var i = from; i <= to; i++) {
      if (!_cache.containsKey(i)) missing.add(i);
    }
    if (missing.isEmpty) return;

    final loadFrom = missing.first;
    final loadTo = missing.last;
    final key = loadFrom * 100000 + loadTo;
    if (_loadingRanges.contains(key)) return;
    _loadingRanges.add(key);

    try {
      final pages = await _repository.fetchTextPages(
        widget.book.id,
        from: loadFrom,
        to: loadTo,
      );
      for (final p in pages) {
        if (p.page >= 1) _cache[p.page] = p;
      }
      for (var i = loadFrom; i <= loadTo; i++) {
        _cache.putIfAbsent(
          i,
          () => TextBookPage(page: i, text: '', isBlank: true),
        );
      }
      if (mounted) setState(() {});
    } finally {
      _loadingRanges.remove(key);
    }
  }

  Future<void> _goToPage(int target) async {
    final page = target.clamp(1, _pageCount);
    if (page == _currentPage && _pageController.hasClients) return;
    await _ensurePagesAround(page);
    if (!mounted || !_pageController.hasClients) return;
    await _pageController.animateToPage(
      page - 1,
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
    );
  }

  void _onPageChanged(int index) {
    final page = index + 1;
    setState(() => _currentPage = page);
    _scheduleSave(page);

    if (_cache.isEmpty) {
      unawaited(_ensurePagesAround(page));
      return;
    }
    final minC = _cache.keys.reduce((a, b) => a < b ? a : b);
    final maxC = _cache.keys.reduce((a, b) => a > b ? a : b);
    if (page - minC <= _prefetchEdge || maxC - page <= _prefetchEdge) {
      unawaited(_ensurePagesAround(page));
    }
  }

  void _scheduleSave(int page) {
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(milliseconds: 500), () async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt('$_prefsPagePrefix${widget.book.id}', page);
      final pdfId = widget.book.pdfFileId;
      if (pdfId != null && pdfId.isNotEmpty) {
        try {
          await _repository.saveReadingProgress(
            pdfFileId: pdfId,
            lastPage: page,
          );
        } catch (_) {}
      }
    });
  }

  Future<void> _goToPageDialog() async {
    // Replace dialog with an in-place overlay to avoid blocking UI.
    setState(() {
      _jumpOpen = true;
      _settingsOpen = false;
      _chromeVisible = true;
      _jumpText = '$_currentPage';
    });
  }

  void _showDisplaySettings() {
    // Replace modal bottom sheet with an in-place overlay.
    setState(() {
      _settingsOpen = true;
      _jumpOpen = false;
      _chromeVisible = true;
    });
  }

  void _closeOverlays() {
    if (!_settingsOpen && !_jumpOpen) return;
    setState(() {
      _settingsOpen = false;
      _jumpOpen = false;
    });
  }

  Future<void> _applyJump() async {
    final raw = _jumpText.trim();
    final n = int.tryParse(raw);
    if (n == null) return;

    final target = n.clamp(1, _pageCount);
    _closeOverlays();
    await _goToPage(target);
  }

  String? _volumeLabelIfDuyLuc() {
    return switch (widget.book.id) {
      '13' => 'QUYỂN HẠ',
      '14' => 'QUYỂN THƯỢNG',
      _ => null,
    };
  }

  @override
  Widget build(BuildContext context) {
    final palette = _palette;
    final overlayStyle = _theme == _ReadingTheme.dark
        ? SystemUiOverlayStyle.light
        : SystemUiOverlayStyle.dark;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: overlayStyle,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        extendBodyBehindAppBar: true,
        appBar: _chromeVisible && !_booting && _bootError == null
            ? AppBar(
                backgroundColor: Colors.transparent,
                surfaceTintColor: Colors.transparent,
                elevation: 0,
                leading: IconButton(
                  icon: const Icon(Icons.arrow_back_rounded),
                  color: palette.text,
                  onPressed: () {
                    _closeOverlays();
                    Navigator.of(context).pop();
                  },
                ),
                title: Builder(builder: (context) {
                  final volume = _volumeLabelIfDuyLuc();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.book.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: palette.text,
                          shadows: [
                            Shadow(
                              blurRadius: 8,
                              color: Colors.black.withValues(alpha: 0.25),
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                      ),
                      if (volume != null)
                        Text(
                          volume,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.3,
                            color: palette.text.withValues(alpha: 0.92),
                            shadows: [
                              Shadow(
                                blurRadius: 8,
                                color: Colors.black.withValues(alpha: 0.25),
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                        ),
                    ],
                  );
                }),
                actions: [
                  IconButton(
                    tooltip: 'Cỡ chữ & nền',
                    onPressed: _showDisplaySettings,
                    icon: Icon(Icons.text_fields_rounded, color: palette.text),
                  ),
                  IconButton(
                    tooltip: _fullscreen ? 'Thoát toàn màn' : 'Toàn màn hình',
                    onPressed: _toggleFullscreen,
                    icon: Icon(
                      _fullscreen
                          ? Icons.fullscreen_exit_rounded
                          : Icons.fullscreen_rounded,
                      color: palette.text,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Đi tới trang',
                    onPressed: _booting ? null : _goToPageDialog,
                    icon: Icon(Icons.tag_rounded, color: palette.text),
                  ),
                ],
              )
            : null,
        body: _booting
            ? Center(
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: palette.accent,
                ),
              )
            : _bootError != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'Không mở được sách:\n$_bootError',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: palette.text),
                      ),
                    ),
                  )
                : Stack(
                    fit: StackFit.expand,
                    children: [
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          image: DecorationImage(
                            image: AssetImage(_bgAsset),
                            fit: BoxFit.cover,
                            alignment: Alignment.bottomLeft,
                          ),
                        ),
                      ),
                      PageView.builder(
                        controller: _pageController,
                        itemCount: _pageCount,
                        onPageChanged: _onPageChanged,
                        itemBuilder: (context, index) {
                          final pageNum = index + 1;
                          final page = _cache[pageNum];
                          if (page == null) {
                            unawaited(_ensurePagesAround(pageNum));
                            return Center(
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: palette.accent,
                              ),
                            );
                          }
                          return _TextPageView(
                            page: page,
                            pageCount: _pageCount,
                            fontSize: _fontSize,
                            lineHeight: _lineHeight,
                            palette: palette,
                            onToggleChrome: _toggleChrome,
                            onPinchStart: () => _pinchBaseFont = _fontSize,
                            onPinchUpdate: (scale) =>
                                _setFontSize(_pinchBaseFont * scale),
                          );
                        },
                      ),
                      if (_settingsOpen || _jumpOpen)
                        Positioned.fill(
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: _closeOverlays,
                            child: ColoredBox(
                              color: Colors.black.withValues(alpha: 0.18),
                            ),
                          ),
                        ),
                      if (_settingsOpen)
                        Positioned(
                          left: 16,
                          right: 16,
                          bottom: 70,
                          child: Material(
                            color: palette.sheet.withValues(alpha: 0.98),
                            elevation: 10,
                            borderRadius: BorderRadius.circular(18),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text(
                                    'Hiển thị',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: palette.text,
                                    ),
                                  ),
                                  const SizedBox(height: 18),
                                  Text(
                                    'Cỡ chữ',
                                    style: TextStyle(
                                      color: palette.muted,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      IconButton(
                                        onPressed: () =>
                                            _setFontSize(_fontSize - 1),
                                        icon: Icon(
                                          Icons.text_decrease_rounded,
                                          color: palette.text,
                                        ),
                                      ),
                                      Expanded(
                                        child: Slider(
                                          value: _fontSize,
                                          min: 14,
                                          max: 36,
                                          divisions: 22,
                                          label: '${_fontSize.round()}',
                                          activeColor: AppTheme.playerAccent,
                                          onChanged: _setFontSize,
                                        ),
                                      ),
                                      IconButton(
                                        onPressed: () =>
                                            _setFontSize(_fontSize + 1),
                                        icon: Icon(
                                          Icons.text_increase_rounded,
                                          color: palette.text,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 14),
                                  Text(
                                    'Nền đọc',
                                    style: TextStyle(
                                      color: palette.muted,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Row(
                                    children: [
                                      for (final t in _ReadingTheme.values)
                                        Expanded(
                                          child: Padding(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 4,
                                            ),
                                            child: _ThemeChip(
                                              label: switch (t) {
                                                _ReadingTheme.light => 'Sáng',
                                                _ReadingTheme.sepia => 'Sepia',
                                                _ReadingTheme.dark => 'Tối',
                                              },
                                              palette: _ReadingPalette.forTheme(
                                                t,
                                              ),
                                              selected: _theme == t,
                                              onTap: () {
                                                setState(() => _theme = t);
                                                unawaited(_persistPrefs());
                                              },
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      if (_jumpOpen)
                        Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 24),
                            child: Material(
                              color: palette.sheet.withValues(alpha: 0.98),
                              elevation: 10,
                              borderRadius: BorderRadius.circular(18),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Text(
                                      'Đi tới trang',
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                        color: palette.text,
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    TextField(
                                      keyboardType: TextInputType.number,
                                      autofocus: true,
                                      decoration: InputDecoration(
                                        hintText: '1 – $_pageCount',
                                      ),
                                      controller: TextEditingController(
                                        text: _jumpText,
                                      ),
                                      onSubmitted: (_) => _applyJump(),
                                      onChanged: (v) => _jumpText = v,
                                    ),
                                    const SizedBox(height: 12),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: OutlinedButton(
                                            onPressed: _closeOverlays,
                                            child: const Text('Hủy'),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: FilledButton(
                                            onPressed: _applyJump,
                                            child: const Text('OK'),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      if (!_chromeVisible && !_fullscreen)
                        Positioned(
                          top: MediaQuery.paddingOf(context).top + 8,
                          left: 8,
                          child: Material(
                            color: palette.chip.withValues(alpha: 0.92),
                            borderRadius: BorderRadius.circular(99),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(99),
                              onTap: () => Navigator.of(context).pop(),
                              child: Padding(
                                padding: const EdgeInsets.all(8),
                                child: Icon(
                                  Icons.arrow_back_rounded,
                                  color: palette.text,
                                  size: 22,
                                ),
                              ),
                            ),
                          ),
                        ),
                      if (_chromeVisible)
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: _BottomBar(
                            palette: palette,
                            current: _currentPage,
                            total: _pageCount,
                            onPrev: _currentPage > 1
                                ? () => _goToPage(_currentPage - 1)
                                : null,
                            onNext: _currentPage < _pageCount
                                ? () => _goToPage(_currentPage + 1)
                                : null,
                          ),
                        ),
                    ],
                  ),
      ),
    );
  }
}

class _ReadingPalette {
  const _ReadingPalette({
    required this.background,
    required this.surface,
    required this.text,
    required this.muted,
    required this.accent,
    required this.border,
    required this.sheet,
    required this.chip,
  });

  final Color background;
  final Color surface;
  final Color text;
  final Color muted;
  final Color accent;
  final Color border;
  final Color sheet;
  final Color chip;

  static _ReadingPalette forTheme(_ReadingTheme theme) {
    return switch (theme) {
      _ReadingTheme.light => const _ReadingPalette(
          background: Color(0xFFFAFAFA),
          surface: Colors.white,
          text: Color(0xFF1A1A1A),
          muted: Color(0xFF757575),
          accent: Color(0xFF5D4037),
          border: Color(0xFFE0E0E0),
          sheet: Colors.white,
          chip: Color(0xFFF5F5F5),
        ),
      _ReadingTheme.sepia => _ReadingPalette(
          background: const Color(0xFFF3E9DC),
          surface: const Color(0xFFFAF6F0).withValues(alpha: 0.92),
          text: const Color(0xFF2C241C),
          muted: const Color(0xFF8B7355),
          accent: const Color(0xFF8D6E63),
          border: const Color(0xFFE8DFD4),
          sheet: const Color(0xFFFAF6F0),
          chip: const Color(0xFFEDE4D8).withValues(alpha: 0.92),
        ),
      _ReadingTheme.dark => const _ReadingPalette(
          background: Color(0xFF121212),
          surface: Color(0xFF1E1E1E),
          text: Color(0xFFE8E4DF),
          muted: Color(0xFF9E958A),
          accent: Color(0xFFD4A574),
          border: Color(0xFF333333),
          sheet: Color(0xFF1E1E1E),
          chip: Color(0xFF2A2A2A),
        ),
    };
  }
}

class _ThemeChip extends StatelessWidget {
  const _ThemeChip({
    required this.label,
    required this.palette,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final _ReadingPalette palette;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: palette.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? palette.accent : palette.border,
              width: selected ? 2 : 1,
            ),
          ),
          child: Column(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: palette.background,
                  shape: BoxShape.circle,
                  border: Border.all(color: palette.border),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: palette.text,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TextPageView extends StatelessWidget {
  const _TextPageView({
    required this.page,
    required this.pageCount,
    required this.fontSize,
    required this.lineHeight,
    required this.palette,
    required this.onToggleChrome,
    required this.onPinchStart,
    required this.onPinchUpdate,
  });

  final TextBookPage page;
  final int pageCount;
  final double fontSize;
  final double lineHeight;
  final _ReadingPalette palette;
  final VoidCallback onToggleChrome;
  final VoidCallback onPinchStart;
  final void Function(double scale) onPinchUpdate;

  TextStyle _textStyle() {
    return TextStyle(
      color: palette.text,
      fontSize: fontSize,
      height: lineHeight,
      fontWeight: FontWeight.w400,
      letterSpacing: 0.15,
      shadows: const [
        Shadow(blurRadius: 6, color: Color(0x66FFFFFF), offset: Offset(0, 1)),
        Shadow(blurRadius: 2, color: Color(0x33000000), offset: Offset(0, 1)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.paddingOf(context).top + 56;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onToggleChrome,
      onScaleStart: (_) => onPinchStart(),
      onScaleUpdate: (details) {
        if (details.pointerCount >= 2) {
          onPinchUpdate(details.scale);
        }
      },
      child: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: EdgeInsets.fromLTRB(22, topPad, 22, 88),
        child: page.isBlank
            ? SizedBox(
                height: MediaQuery.sizeOf(context).height * 0.5,
                child: Center(
                  child: Text(
                    'Trang ${page.page} — trống',
                    style: TextStyle(
                      color: palette.muted,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              )
            : Text(page.text, style: _textStyle()),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.palette,
    required this.current,
    required this.total,
    required this.onPrev,
    required this.onNext,
  });

  final _ReadingPalette palette;
  final int current;
  final int total;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 0, 8, 4),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Trang trước',
              onPressed: onPrev,
              icon: Icon(Icons.chevron_left_rounded, color: palette.text),
            ),
            Expanded(
              child: Text(
                'Trang $current / $total',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: palette.text,
                  shadows: const [
                    Shadow(
                      blurRadius: 8,
                      color: Color(0xCCFFFFFF),
                      offset: Offset(0, 1),
                    ),
                  ],
                ),
              ),
            ),
            IconButton(
              tooltip: 'Trang sau',
              onPressed: onNext,
              icon: Icon(Icons.chevron_right_rounded, color: palette.text),
            ),
          ],
        ),
      ),
    );
  }
}
