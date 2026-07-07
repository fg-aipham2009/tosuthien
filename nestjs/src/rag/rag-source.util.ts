/**
 * Corpus tiers — HT Duy Lực Ngữ Lục (13/14) is commentary/Q&A;
 * all other ingested books are treated as kinh / nguyên tác / ngữ lục Tổ.
 */
export type SourceTier = 'kinh' | 'ngu_luc';

const NGU_LUC_FILES = new Set(['13.txt', '14.txt']);

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
