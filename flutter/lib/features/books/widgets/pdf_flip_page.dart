import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';

/// Single PDF page inside the flipbook (paper + light shadow).
///
/// Caps DPI on mobile to keep memory stable during page-flip captures.
class PdfFlipPage extends StatelessWidget {
  const PdfFlipPage({
    super.key,
    required this.document,
    required this.pageNumber,
  });

  final PdfDocument document;
  final int pageNumber;

  static const _paper = Color(0xFFFFF8E7);

  static double get _dpi {
    // Web WASM rasterizes slowly; keep DPI modest so page turns stay responsive.
    if (kIsWeb) return 120;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
      case TargetPlatform.iOS:
        return 110;
      default:
        return 140;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: _paper,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.14),
                blurRadius: 10,
                offset: const Offset(2, 3),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: PdfPageView(
              document: document,
              pageNumber: pageNumber,
              maximumDpi: _dpi,
              backgroundColor: Colors.white,
              decoration: const BoxDecoration(color: Colors.white),
            ),
          ),
        ),
      ),
    );
  }
}
