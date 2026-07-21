/**
 * Corpus tiers — HT Duy Lực Ngữ Lục (13/14) is commentary/Q&A;
 * all other ingested books are treated as kinh / nguyên tác / ngữ lục Tổ.
 */
export type SourceTier = 'kinh' | 'ngu_luc';

const NGU_LUC_FILES = new Set(['13.txt', '14.txt']);

/**
 * OCR/RAG markers are already printed page numbers (after text alignment).
 * Keep this at 0 unless a corpus again stores raw OCR indices.
 */
const PRINTED_PAGE_OFFSET_BY_STEM: Record<string, number> = {};

/**
 * Printed page → PDF viewer page index.
 * Derived from text pageCount − PDF pageCount per book (scanned PDFs omit/extra
 * front-matter vs printed headers). filePage = max(1, printed − offset).
 *
 * Positive: PDF is shorter than printed max (open earlier file page).
 * Negative: PDF has extra front pages (open later file page).
 */
const PDF_FILE_PAGE_OFFSET_BY_STEM: Record<string, number> = {
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

function sourceStem(sourceFile: string | null | undefined): string {
  if (!sourceFile) return '';
  const name = sourceFile.split(/[/\\]/).pop() ?? '';
  return name.replace(/\.(txt|pdf)$/i, '').trim().toLowerCase();
}

/** Add to OCR/file page to get the printed page shown in the book. */
export function printedPageOffset(sourceFile: string | null | undefined): number {
  return PRINTED_PAGE_OFFSET_BY_STEM[sourceStem(sourceFile)] ?? 0;
}

/** Subtract from printed page to get the PDF `#page=` index. */
export function pdfFilePageOffset(sourceFile: string | null | undefined): number {
  return PDF_FILE_PAGE_OFFSET_BY_STEM[sourceStem(sourceFile)] ?? 0;
}

export function toPrintedPage(
  sourceFile: string | null | undefined,
  ocrPage: number | null | undefined,
): number | null {
  if (ocrPage == null) return null;
  return ocrPage + printedPageOffset(sourceFile);
}

/** Convert printed page (API/citation) back to PDF file page for openers. */
export function toPdfFilePage(
  sourceFile: string | null | undefined,
  printedPage: number | null | undefined,
): number | null {
  if (printedPage == null) return null;
  return Math.max(1, printedPage - pdfFilePageOffset(sourceFile));
}

export function sourceTier(title: string, sourceFile: string): SourceTier {
  if (NGU_LUC_FILES.has(sourceFile.toLowerCase())) {
    return 'ngu_luc';
  }
  const t = title.toLowerCase();
  if (t.includes('duy lực ngữ lục')) {
    return 'ngu_luc';
  }
  return 'kinh';
}

export function isKinhSource(title: string, sourceFile: string): boolean {
  return sourceTier(title, sourceFile) === 'kinh';
}
