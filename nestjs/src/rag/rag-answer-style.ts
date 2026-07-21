import { PassageHit } from './rag.types';
import { isKinhSource, SourceTier, sourceTier } from './rag-source.util';

export type AnswerStyle = 'kinh_long' | 'mixed' | 'brief';

export interface AnswerStyleContext {
  style: AnswerStyle;
  kinhBlockCount: number;
  nguLucBlockCount: number;
}

const STRONG_RELEVANCE = 2;

export function tierLabel(tier: SourceTier): string {
  return tier === 'kinh' ? 'KINH' : 'NGỮ LỤC';
}

export function resolveAnswerStyle(
  hits: PassageHit[],
  relevanceOf: (hit: PassageHit) => number,
): AnswerStyleContext {
  const kinhHits = hits.filter((h) => isKinhSource(h.title, h.sourceFile));
  const nguLucHits = hits.filter((h) => !isKinhSource(h.title, h.sourceFile));

  const strongKinh = kinhHits.some((h) => relevanceOf(h) >= STRONG_RELEVANCE);

  let style: AnswerStyle;
  if (kinhHits.length === 0 || !strongKinh) {
    style = 'brief';
  } else if (nguLucHits.length === 0) {
    style = 'kinh_long';
  } else {
    style = 'mixed';
  }

  return {
    style,
    kinhBlockCount: kinhHits.length,
    nguLucBlockCount: nguLucHits.length,
  };
}

export function maxPassageCharsForTier(tier: SourceTier): number {
  return tier === 'kinh' ? 20_000 : 10_000;
}
