/// Printed (text/`--- N ---`) → PDF viewer `#page=` / goToPage index.
/// Keep in sync with nestjs/src/rag/rag-source.util.ts PDF_FILE_PAGE_OFFSET_BY_STEM
/// and portal/src/lib/openCitation.ts.
const pdfFilePageOffsetByStem = <String, int>{
  '1': 2,
  '2': 2,
  '5': 2,
  '9': 2,
  '10': 2,
  '11': 2,
  '13': -2,
  '14': -2,
  '15': 2,
  '17': 3,
  '18': 3,
  '22': 2,
};

String? sourceStem(String? sourceFile) {
  if (sourceFile == null || sourceFile.trim().isEmpty) return null;
  final name = sourceFile.trim().split(RegExp(r'[/\\]')).last;
  return name.replaceAll(RegExp(r'\.(txt|pdf)$', caseSensitive: false), '').toLowerCase();
}

/// Convert printed page (RAG / text marker) to PDF file page index.
int toPdfFilePage(String? sourceFile, int printedPage) {
  final stem = sourceStem(sourceFile) ?? '';
  final offset = pdfFilePageOffsetByStem[stem] ?? 0;
  final page = printedPage - offset;
  return page < 1 ? 1 : page;
}
