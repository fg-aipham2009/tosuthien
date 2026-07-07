import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';

/// Single PDF page inside the flipbook (paper + shadow).
class PdfFlipPage extends StatelessWidget {
  const PdfFlipPage({
    super.key,
    required this.document,
    required this.pageNumber,
  });

  final PdfDocument document;
  final int pageNumber;

  static const _paper = Color(0xFFFFF8E7);

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
              maximumDpi: 140,
              backgroundColor: Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}
