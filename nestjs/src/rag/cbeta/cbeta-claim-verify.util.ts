/**
 * Deterministic claim ↔ evidence checks for CBETA answers.
 * Exact / punctuation / OpenCC-variant matching — no LLM judge.
 * Never rewrites historical quotations in citation payloads.
 */

import { toTraditionalZh } from './cbeta-opencc.util';
import { extractScripturePhraseNeedles } from './cbeta-scripture-intent.util';
import { bareCbetaRef, cbetaRefCovers, normalizeCbetaRef } from './cbeta-ref-range.util';
import type { CbetaChunkHit } from './cbeta.types';

export type ClaimSupportStatus =
  | 'supported'
  | 'partially_supported'
  | 'unsupported'
  | 'contradicted'
  | 'interpretive_disagreement'
  | 'insufficient_evidence';

export type ClaimInterpretationType =
  | 'literal_textual'
  | 'contextual_explanation'
  | 'commentarial_interpretation'
  | 'cross_text_synthesis'
  | 'unsupported_speculation'
  | 'verbatim'
  | 'contextual'
  | 'none';

export interface CbetaClaimRecord {
  claim_id: string;
  claim_text: string;
  claim_type:
    | 'exact_quote'
    | 'doctrinal_interpretation'
    | 'source_locator'
    | 'contextual_explanation'
    | 'commentarial_attribution';
  source_id: string;
  locator: string;
  evidence_text: string;
  support_status: ClaimSupportStatus;
  interpretation_type: ClaimInterpretationType;
  match_kind?: 'exact' | 'punct_normalized' | 'opencc_variant' | 'none';
  verified_as_verbatim?: boolean;
}

export type PhraseMatchKind =
  | 'exact'
  | 'punct_normalized'
  | 'opencc_variant'
  | 'none';

/** Strip punctuation/whitespace for containment; keep CJK letters. */
export function normalizeCjkForMatch(s: string): string {
  return (s || '')
    .normalize('NFC')
    .replace(
      /[\s\u3000，。、；：？！「」『』（）()【】\[\]《》〈〉""''·・]/g,
      '',
    );
}

/**
 * Match phrase against evidence without mutating stored evidence text.
 * OpenCC is applied only to the *search needle*, never to rewrite citations.
 */
export function evidenceContainsPhrase(
  evidence: string,
  phrase: string,
): PhraseMatchKind {
  const e = evidence || '';
  const p = (phrase || '').trim();
  if (!p) return 'none';
  if (e.includes(p)) return 'exact';

  const eNorm = normalizeCjkForMatch(e);
  const pNorm = normalizeCjkForMatch(p);
  if (pNorm && eNorm.includes(pNorm)) return 'punct_normalized';

  // Variant: convert needle to Traditional; compare normalized forms.
  // Do not convert evidence (preserve historical orthography in citations).
  try {
    const pTrad = toTraditionalZh(p);
    if (pTrad && pTrad !== p && e.includes(pTrad)) return 'opencc_variant';
    const pTradNorm = normalizeCjkForMatch(pTrad);
    if (pTradNorm && eNorm.includes(pTradNorm)) return 'opencc_variant';
  } catch {
    // OpenCC unavailable — fall through
  }
  return 'none';
}

export function matchKindToSupport(
  kind: PhraseMatchKind,
): ClaimSupportStatus {
  switch (kind) {
    case 'exact':
      return 'supported';
    case 'punct_normalized':
    case 'opencc_variant':
      return 'partially_supported';
    default:
      return 'insufficient_evidence';
  }
}

export function isVerbatimApproved(kind: PhraseMatchKind): boolean {
  return kind === 'exact' || kind === 'punct_normalized' || kind === 'opencc_variant';
}

function excerptAround(content: string, phrase: string, radius = 40): string {
  const raw = content || '';
  const p = phrase || '';
  let idx = raw.indexOf(p);
  if (idx < 0) {
    const nContent = normalizeCjkForMatch(raw);
    const nPhrase = normalizeCjkForMatch(p);
    // Best-effort: return head of chunk if normalized-only match
    if (nPhrase && nContent.includes(nPhrase)) {
      return raw.slice(0, Math.min(raw.length, p.length + radius * 2));
    }
    return '';
  }
  const from = Math.max(0, idx - radius);
  const to = Math.min(raw.length, idx + p.length + radius);
  return raw.slice(from, to);
}

/**
 * Build claim records for long CJK phrases in the question against evidence hits.
 */
export function verifyQuestionPhrasesAgainstEvidence(
  question: string,
  hits: CbetaChunkHit[],
): CbetaClaimRecord[] {
  const phrases = extractScripturePhraseNeedles(question);
  const records: CbetaClaimRecord[] = [];
  let i = 0;
  for (const phrase of phrases) {
    if (phrase.length < 4) continue;
    let best: CbetaChunkHit | null = null;
    let how: PhraseMatchKind = 'none';
    for (const h of hits) {
      const r = evidenceContainsPhrase(h.contentZh, phrase);
      if (r === 'exact') {
        best = h;
        how = 'exact';
        break;
      }
      if (r !== 'none' && how === 'none') {
        best = h;
        how = r;
      } else if (
        r === 'punct_normalized' &&
        how === 'opencc_variant'
      ) {
        best = h;
        how = r;
      }
    }
    i += 1;
    records.push({
      claim_id: `qphrase_${i}`,
      claim_text: phrase,
      claim_type: 'exact_quote',
      source_id: best?.workCode || '',
      locator: best?.cbetaRefStart || '',
      evidence_text: best ? excerptAround(best.contentZh, phrase) : '',
      support_status: matchKindToSupport(how),
      interpretation_type:
        how === 'none' ? 'none' : 'literal_textual',
      match_kind: how,
      verified_as_verbatim: isVerbatimApproved(how),
    });
  }
  return records;
}

/** CJK spans inside the answer that look like scripture quotes. */
export function extractAnswerCjkQuotes(answer: string): string[] {
  const a = answer || '';
  const quoted =
    a.match(/[「『"“]([\u3400-\u9fff，。、；：？！]{4,40})[」』"”]/g) || [];
  const fromQ = quoted.map((s) => s.replace(/^[「『"“]|[」』"”]$/g, ''));
  // Avoid harvesting every CJK run from Vietnamese prose — only fenced quotes
  // plus runs marked as original wording cues.
  const labeled =
    a.match(
      /(?:nguyên văn|原文|verbatim|quotation)[:：\s]*([「『"“]?[\u3400-\u9fff，。、]{6,40})/gi,
    ) || [];
  const fromLabeled = labeled
    .map((s) => s.replace(/^[^「『"“\u3400-\u9fff]+/, '').replace(/[」』"”]/g, ''))
    .filter((s) => /[\u3400-\u9fff]{6,}/.test(s));
  return [...new Set([...fromQ, ...fromLabeled])];
}

export function verifyAnswerQuotesAgainstEvidence(
  answer: string,
  hits: CbetaChunkHit[],
): { unsupportedQuotes: string[]; records: CbetaClaimRecord[] } {
  const quotes = extractAnswerCjkQuotes(answer);
  const unsupportedQuotes: string[] = [];
  const records: CbetaClaimRecord[] = [];
  let i = 0;
  for (const phrase of quotes) {
    i += 1;
    let how: PhraseMatchKind = 'none';
    let best: CbetaChunkHit | null = null;
    for (const h of hits) {
      const r = evidenceContainsPhrase(h.contentZh, phrase);
      if (r === 'exact') {
        how = 'exact';
        best = h;
        break;
      }
      if (r !== 'none' && how === 'none') {
        how = r;
        best = h;
      }
    }
    const verbatimOk = isVerbatimApproved(how);
    if (!verbatimOk && phrase.length >= 6) {
      unsupportedQuotes.push(phrase);
    }
    records.push({
      claim_id: `ans_quote_${i}`,
      claim_text: phrase,
      claim_type: 'exact_quote',
      source_id: best?.workCode || '',
      locator: best?.cbetaRefStart || '',
      evidence_text: best ? excerptAround(best.contentZh, phrase) : '',
      support_status: verbatimOk
        ? matchKindToSupport(how)
        : 'unsupported',
      interpretation_type: verbatimOk ? 'literal_textual' : 'unsupported_speculation',
      match_kind: how,
      verified_as_verbatim: verbatimOk,
    });
  }
  return { unsupportedQuotes, records };
}

/** Verify a user-supplied locator against hit spans (no invented refs). */
export function verifyLocatorAgainstHits(
  needle: string | null | undefined,
  workCodes: string[],
  hits: CbetaChunkHit[],
): CbetaClaimRecord {
  const bare = bareCbetaRef(needle);
  const claim_text = bare || '(no locator)';
  if (!bare) {
    return {
      claim_id: 'locator_1',
      claim_text,
      claim_type: 'source_locator',
      source_id: '',
      locator: '',
      evidence_text: '',
      support_status: 'insufficient_evidence',
      interpretation_type: 'none',
      match_kind: 'none',
      verified_as_verbatim: false,
    };
  }
  const allowed = new Set(workCodes);
  const hit = hits.find((h) => {
    if (allowed.size && !allowed.has(h.workCode)) return false;
    return (
      cbetaRefCovers(h.cbetaRefStart, h.cbetaRefStart, bare) ||
      bareCbetaRef(h.cbetaRefStart).includes(bare) ||
      (normalizeCbetaRef(h.cbetaRefStart) || '') ===
        (normalizeCbetaRef(bare) || '')
    );
  });
  // Also accept covering spans when end is unknown: page-family match in work.
  const soft =
    hit ||
    hits.find((h) => {
      if (allowed.size && !allowed.has(h.workCode)) return false;
      const start = bareCbetaRef(h.cbetaRefStart);
      return start.slice(0, 4) === bare.slice(0, 4);
    });
  return {
    claim_id: 'locator_1',
    claim_text: bare,
    claim_type: 'source_locator',
    source_id: soft?.workCode || '',
    locator: soft?.cbetaRefStart || bare,
    evidence_text: soft ? soft.contentZh.slice(0, 120) : '',
    support_status: soft ? 'supported' : 'insufficient_evidence',
    interpretation_type: soft ? 'literal_textual' : 'none',
    match_kind: soft ? 'exact' : 'none',
    verified_as_verbatim: !!soft,
  };
}
