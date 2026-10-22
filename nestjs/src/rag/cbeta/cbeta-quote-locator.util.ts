/**
 * Map a verified quotation to the best available CBETA locator.
 * Without per-character TEI offsets we only have chunk ref start/end —
 * never invent line numbers.
 */

import { bareCbetaRef } from './cbeta-ref-range.util';
import type { CbetaChunkHit } from './cbeta.types';

export type LocatorPrecision = 'passage' | 'quote_approx' | 'unavailable';

export interface QuoteLocatorResult {
  workId: string;
  juan: number | null;
  chunkStartLocator: string | null;
  chunkEndLocator: string | null;
  /** Best locator for the quote; passage-level unless finer map exists. */
  quoteStartLocator: string | null;
  quoteEndLocator: string | null;
  locatorPrecision: LocatorPrecision;
  /** Exact substring copied from evidence (never rewritten). */
  evidenceSpan: string;
  evidenceId: string;
}

/**
 * Locate quote inside a hit. Uses chunk cbeta_ref_start as passage locator.
 * quote_approx only when the phrase is found and we keep the same start ref
 * (no fabricated mid-chunk linehead).
 */
export function locateQuoteInHit(
  hit: CbetaChunkHit,
  quote: string,
  chunkEndRef?: string | null,
): QuoteLocatorResult | null {
  const q = (quote || '').trim();
  if (!q || !hit?.contentZh) return null;
  const idx = hit.contentZh.indexOf(q);
  if (idx < 0) return null;
  const start = bareCbetaRef(hit.cbetaRefStart) || hit.cbetaRefStart;
  const end =
    bareCbetaRef(chunkEndRef) ||
    bareCbetaRef(hit.cbetaRefStart) ||
    hit.cbetaRefStart;
  return {
    workId: hit.workCode,
    juan: hit.juanNo,
    chunkStartLocator: start,
    chunkEndLocator: end,
    quoteStartLocator: start,
    quoteEndLocator: end,
    // Same as chunk start until TEI char maps exist — label honestly.
    locatorPrecision: 'passage',
    evidenceSpan: hit.contentZh.slice(idx, idx + q.length),
    evidenceId: hit.id,
  };
}

/** Prefer hit that contains the quote; else null. */
export function locateQuoteInHits(
  hits: CbetaChunkHit[],
  quote: string,
): QuoteLocatorResult | null {
  for (const h of hits) {
    const loc = locateQuoteInHit(h, quote);
    if (loc) return loc;
  }
  return null;
}
