/**
 * Align LLM “verbatim” quotes to exact evidence spans.
 * Restores missing/extra characters (e.g. 得) only when the evidence span
 * is an unambiguous near-match — never invents text outside the chunk.
 */

import {
  evidenceContainsPhrase,
  normalizeCjkForMatch,
} from './cbeta-claim-verify.util';
import type { CbetaChunkHit } from './cbeta.types';

export interface QuoteAlignResult {
  original: string;
  aligned: string;
  workCode: string;
  chunkId: string;
  kind: 'exact' | 'punct_normalized' | 'near_span';
}

const MAX_INDEL = 2;

/**
 * Find a contiguous evidence substring that matches quote with at most
 * MAX_INDEL insertions/deletions on CJK letters (after punct strip).
 */
export function findAlignedEvidenceSpan(
  evidence: string,
  quote: string,
): { span: string; kind: QuoteAlignResult['kind'] } | null {
  const e = evidence || '';
  const q = (quote || '').trim();
  if (!q || !e) return null;
  if (e.includes(q)) return { span: q, kind: 'exact' };

  const kind = evidenceContainsPhrase(e, q);
  if (kind === 'punct_normalized' || kind === 'opencc_variant') {
    // Recover an exact contiguous span ≈ quote length from evidence.
    const qNorm = normalizeCjkForMatch(q);
    const window = Math.min(e.length, q.length + MAX_INDEL + 8);
    for (let i = 0; i + q.length - MAX_INDEL <= e.length; i++) {
      const cand = e.slice(i, i + window);
      const cNorm = normalizeCjkForMatch(cand);
      if (cNorm.includes(qNorm) || qNorm.includes(cNorm.slice(0, qNorm.length))) {
        // Shrink cand to shortest slice whose norm contains qNorm.
        for (let len = q.length - MAX_INDEL; len <= q.length + MAX_INDEL + 4; len++) {
          if (len < 4 || i + len > e.length) continue;
          const span = e.slice(i, i + len);
          if (normalizeCjkForMatch(span) === qNorm) {
            return { span, kind: 'punct_normalized' };
          }
          if (
            normalizeCjkForMatch(span).includes(qNorm) &&
            Math.abs(normalizeCjkForMatch(span).length - qNorm.length) <= MAX_INDEL
          ) {
            return { span, kind: 'near_span' };
          }
        }
      }
    }
  }

  // Near span: indel-only (insertion/deletion), no substitutions.
  // Example: quote 不樂故解脫 ↔ evidence 不樂故得解脫 (one inserted 得).
  const qNorm = normalizeCjkForMatch(q);
  if (qNorm.length < 4) return null;
  const minLen = Math.max(4, q.length - MAX_INDEL);
  const maxLen = q.length + MAX_INDEL;
  let best: { span: string; sNorm: string; score: number } | null = null;
  const step = e.length > 4000 ? 2 : 1;
  for (let i = 0; i < e.length; i += step) {
    for (let len = minLen; len <= maxLen && i + len <= e.length; len++) {
      const span = e.slice(i, i + len);
      if (!/^[\u3400-\u9fff]/.test(span)) continue;
      const sNorm = normalizeCjkForMatch(span);
      if (!sNorm || Math.abs(sNorm.length - qNorm.length) > MAX_INDEL) continue;
      if (!isIndelOnly(sNorm, qNorm, MAX_INDEL)) continue;
      // Prefer evidence-supersequence (restores omitted chars), then minimal span.
      const score =
        (sNorm.length >= qNorm.length ? 100 : 0) +
        sNorm.length * 2 -
        span.length;
      if (!best || score > best.score) best = { span, sNorm, score };
    }
  }
  return best ? { span: best.span, kind: 'near_span' } : null;
}

/** True when one string is the other with ≤maxIndel insertions only (no substitutions). */
function isIndelOnly(a: string, b: string, maxIndel: number): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (longer.length - shorter.length > maxIndel) return false;
  let i = 0;
  for (const ch of longer) {
    if (i < shorter.length && ch === shorter[i]) i += 1;
  }
  return i === shorter.length;
}

/**
 * Replace fenced answer quotes with exact evidence spans when alignable.
 */
export function repairAnswerQuotesFromEvidence(
  answer: string,
  hits: CbetaChunkHit[],
): { answer: string; repairs: QuoteAlignResult[] } {
  const repairs: QuoteAlignResult[] = [];
  let out = answer || '';
  const fenced =
    out.match(/[「『"“]([\u3400-\u9fff，。、；：？！]{4,80})[」』"”]/g) || [];
  for (const full of fenced) {
    const inner = full.replace(/^[「『"“]|[」』"”]$/g, '');
    let best: QuoteAlignResult | null = null;
    for (const h of hits) {
      const aligned = findAlignedEvidenceSpan(h.contentZh, inner);
      if (!aligned) continue;
      best = {
        original: inner,
        aligned: aligned.span,
        workCode: h.workCode,
        chunkId: h.id,
        kind: aligned.kind,
      };
      if (aligned.kind === 'exact') break;
    }
    if (best && best.aligned !== best.original) {
      const escaped = full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(
        new RegExp(escaped, 'g'),
        `「${best.aligned}」`,
      );
      repairs.push(best);
    } else if (best && best.kind === 'exact') {
      repairs.push(best);
    }
  }
  return { answer: out, repairs };
}
