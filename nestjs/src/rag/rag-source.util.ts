/**
 * Corpus tiers — HT Duy Lực Ngữ Lục (13/14) is commentary/Q&A;
 * all other ingested books are treated as kinh / nguyên tác / ngữ lục Tổ.
 */
export type SourceTier = 'kinh' | 'ngu_luc';

const NGU_LUC_FILES = new Set(['13.txt', '14.txt']);

/**
 * OCR/PDF file page → printed page number on the scan.
 * After aligning text/*.txt markers to printed headers, offset is 0 for all books.
 * Keep this map only if a future source still mismatches.
 */
const PRINTED_PAGE_OFFSET_BY_STEM: Record<string, number> = {};

function sourceStem(sourceFile: string | null | undefined): string {
  if (!sourceFile) return '';
  const name = sourceFile.split(/[/\\]/).pop() ?? '';
  return name.replace(/\.(txt|pdf)$/i, '').trim().toLowerCase();
}

/** Add to OCR/file page to get the printed page shown in the book. */
export function printedPageOffset(sourceFile: string | null | undefined): number {
  return PRINTED_PAGE_OFFSET_BY_STEM[sourceStem(sourceFile)] ?? 0;
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
  return Math.max(1, printedPage - printedPageOffset(sourceFile));
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
