/**
 * Contextual scripture verification: quotation ≠ doctrinal correctness.
 * Links draft interpretive claims to evidence with typed support statuses.
 */

import {
  evidenceContainsPhrase,
  type CbetaClaimRecord,
  type ClaimSupportStatus,
  type ClaimInterpretationType,
} from './cbeta-claim-verify.util';
import { inferCbetaGenre } from './cbeta-genre.util';
import { extractScripturePhraseNeedles } from './cbeta-scripture-intent.util';
import type { CbetaChunkHit } from './cbeta.types';

export interface ContextualEvidencePack {
  primary: CbetaChunkHit | null;
  neighbors: CbetaChunkHit[];
  speakerHint: string | null;
  sectionHint: string | null;
}

/** Pull light speaker / section cues from a Hán block (heuristic). */
export function extractSpeakerSectionHints(contentZh: string): {
  speakerHint: string | null;
  sectionHint: string | null;
} {
  const t = contentZh || '';
  const speaker =
    t.match(
      /((?:佛|世尊|如來|菩薩|[\u3400-\u9fff]{2,6}(?:尊者|比丘|比丘尼|居士))曰)/u,
    )?.[1] || null;
  const section =
    t.match(
      /((?:第[一二三四五六七八九十百千\d]+[品分卷]|[\u3400-\u9fff]{2,12}品))/u,
    )?.[1] || null;
  return { speakerHint: speaker, sectionHint: section };
}

/**
 * Build contextual pack: primary = best phrase hit; neighbors = same work,
 * adjacent chunkIndex when present in the hit list.
 */
export function buildContextualEvidencePack(
  question: string,
  hits: CbetaChunkHit[],
): ContextualEvidencePack {
  const phrases = extractScripturePhraseNeedles(question).filter(
    (p) => p.length >= 4,
  );
  let primary: CbetaChunkHit | null = null;
  for (const p of phrases) {
    const hit = hits.find((h) => evidenceContainsPhrase(h.contentZh, p) !== 'none');
    if (hit) {
      primary = hit;
      break;
    }
  }
  if (!primary) primary = hits[0] || null;
  const neighbors =
    primary == null
      ? []
      : hits.filter(
          (h) =>
            h.workCode === primary!.workCode &&
            h.id !== primary!.id &&
            Math.abs(h.chunkIndex - primary!.chunkIndex) <= 2,
        );
  const hints = extractSpeakerSectionHints(primary?.contentZh || '');
  return {
    primary,
    neighbors,
    speakerHint: hints.speakerHint,
    sectionHint: hints.sectionHint,
  };
}

const INTERPRETIVE_CUES =
  /(?:nghĩa là|có nghĩa|ý nghĩa|giải thích|theo đó|implies|means that|interpreted as|được hiểu|vậy nên|do đó)/i;

const COMMENTARY_CUES =
  /(?:sớ|chú|疏|鈔|註|論曰|giải của|theo\s+[\u3400-\u9fff]{2,6}|Nāgārjuna|Long Thọ|世親|無著)/i;

/**
 * Extract coarse interpretive claim sentences from a draft answer.
 */
export function extractInterpretiveClaims(answer: string): string[] {
  const text = (answer || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const parts = text
    .split(/(?<=[。.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
  return parts.filter(
    (s) => INTERPRETIVE_CUES.test(s) || COMMENTARY_CUES.test(s) || /[\u3400-\u9fff]{4,}/.test(s),
  );
}

function classifyClaimType(sentence: string): {
  claim_type: CbetaClaimRecord['claim_type'];
  interpretation_type: ClaimInterpretationType;
} {
  if (COMMENTARY_CUES.test(sentence)) {
    return {
      claim_type: 'commentarial_attribution',
      interpretation_type: 'commentarial_interpretation',
    };
  }
  if (INTERPRETIVE_CUES.test(sentence)) {
    return {
      claim_type: 'contextual_explanation',
      interpretation_type: 'contextual_explanation',
    };
  }
  if (/[\u3400-\u9fff]{6,}/.test(sentence) && /「|『|"/.test(sentence)) {
    return {
      claim_type: 'exact_quote',
      interpretation_type: 'literal_textual',
    };
  }
  return {
    claim_type: 'doctrinal_interpretation',
    interpretation_type: 'cross_text_synthesis',
  };
}

function supportForInterpretive(
  sentence: string,
  pack: ContextualEvidencePack,
): { status: ClaimSupportStatus; source_id: string; locator: string; evidence_text: string } {
  const pool = [
    pack.primary,
    ...pack.neighbors,
  ].filter((h): h is CbetaChunkHit => !!h);
  // Keyword overlap: require at least one substantive CJK bigram from sentence in evidence.
  const bigrams = sentence.match(/[\u3400-\u9fff]{2}/g) || [];
  const uniq = [...new Set(bigrams)].filter((b) => !/的是也而於以/.test(b));
  let best: CbetaChunkHit | null = null;
  let hits = 0;
  for (const h of pool) {
    let n = 0;
    for (const b of uniq) {
      if (h.contentZh.includes(b)) n += 1;
    }
    if (n > hits) {
      hits = n;
      best = h;
    }
  }
  const need = Math.min(3, Math.max(1, Math.floor(uniq.length / 4)));
  if (!best || hits < need) {
    return {
      status: 'insufficient_evidence',
      source_id: '',
      locator: '',
      evidence_text: '',
    };
  }
  const genre = inferCbetaGenre({
    titleZh: best.titleZh,
    collection: best.collection,
    workCode: best.workCode,
  });
  // Commentarial claim without commentary genre → partial / disagreement risk.
  if (
    COMMENTARY_CUES.test(sentence) &&
    genre !== '疏' &&
    genre !== '鈔' &&
    genre !== '註' &&
    genre !== '論'
  ) {
    return {
      status: 'partially_supported',
      source_id: best.workCode,
      locator: best.cbetaRefStart || '',
      evidence_text: best.contentZh.slice(0, 160),
    };
  }
  return {
    status: hits >= need + 2 ? 'supported' : 'partially_supported',
    source_id: best.workCode,
    locator: best.cbetaRefStart || '',
    evidence_text: best.contentZh.slice(0, 160),
  };
}

/**
 * Link interpretive sentences to contextual evidence pack.
 */
export function verifyContextualClaims(
  question: string,
  answer: string,
  hits: CbetaChunkHit[],
): { pack: ContextualEvidencePack; claims: CbetaClaimRecord[] } {
  const pack = buildContextualEvidencePack(question, hits);
  const sentences = extractInterpretiveClaims(answer);
  const claims: CbetaClaimRecord[] = [];
  let i = 0;
  for (const sentence of sentences) {
    i += 1;
    const typed = classifyClaimType(sentence);
    const support = supportForInterpretive(sentence, pack);
    let status = support.status;
    let interp = typed.interpretation_type;
    if (status === 'insufficient_evidence' && INTERPRETIVE_CUES.test(sentence)) {
      interp = 'unsupported_speculation';
      status = 'unsupported';
    }
    claims.push({
      claim_id: `ctx_${i}`,
      claim_text: sentence.slice(0, 200),
      claim_type: typed.claim_type,
      source_id: support.source_id,
      locator: support.locator,
      evidence_text: support.evidence_text,
      support_status: status,
      interpretation_type: interp,
      verified_as_verbatim: false,
    });
  }
  return { pack, claims };
}
