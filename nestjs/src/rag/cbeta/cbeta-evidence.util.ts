/**
 * Evidence selection + light answer validation for CBETA grounding.
 */

import { extractPreservedCjk } from './cbeta-query-parse.util';
import {
  extractPersonRelationNeedles,
  parsePersonFasuccessorBlock,
} from './cbeta-person-relation.util';
import {
  extractScripturePhraseNeedles,
  extractScriptureTitleCues,
  isCbetaQuoteVerifyIntent,
  isCbetaScriptureExplainIntent,
  isCbetaTranslateIntent,
  titleCueAffinity,
} from './cbeta-scripture-intent.util';
import {
  verifyAnswerQuotesAgainstEvidence,
  verifyQuestionPhrasesAgainstEvidence,
} from './cbeta-claim-verify.util';
import type { CbetaChunkHit, CbetaRouteDecision } from './cbeta.types';
import { isCbetaBriefQuestion } from './cbeta-intent.util';
import { bareCbetaRef, cbetaRefCovers } from './cbeta-ref-range.util';
import {
  evidenceContainsPhrase,
  normalizeCjkForMatch,
} from './cbeta-claim-verify.util';
import { inferCbetaGenre } from './cbeta-genre.util';

/** One best-scoring chunk per work_code (stable cite set, no invented max-N). */
function dedupeByWork(hits: CbetaChunkHit[]): CbetaChunkHit[] {
  const best = new Map<string, CbetaChunkHit>();
  for (const h of [...hits].sort((a, b) => b.score - a.score)) {
    const w = h.workCode || h.id;
    if (!best.has(w)) best.set(w, h);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

function hitHasPhrase(content: string, phrase: string): boolean {
  return evidenceContainsPhrase(content, phrase) !== 'none';
}

/** Higher = closer to primary scriptural/treatise body (not commentary dump). */
function genrePriority(h: CbetaChunkHit): number {
  const g = inferCbetaGenre({
    titleZh: h.titleZh,
    collection: h.collection,
    workCode: h.workCode,
  });
  switch (g) {
    case '經':
      return 5;
    case '律':
      return 4;
    case '論':
      return 4;
    case '語錄':
      return 2;
    case '燈錄':
    case '傳記':
    case '史料':
      return 1;
    case '疏':
    case '鈔':
    case '註':
      return 0;
    default:
      return 1;
  }
}

/**
 * Collect explicit work IDs from decision + question text.
 * When non-empty these are hard constraints (no sister-translation substitute).
 */
export function explicitWorkCodes(
  question: string,
  decision: CbetaRouteDecision,
): Set<string> {
  const named = new Set(decision.workCodes);
  const fromQ =
    question.match(/\b[TXAJHKLSNDtxajhklsnd]\s*\d{1,2}\s*n\s*\d{3,4}[a-zA-Z]?\b/gi) ||
    [];
  for (const w of fromQ) {
    const m = w.match(/([TXAJHKLSNDtxajhklsnd])\s*(\d{1,2})\s*n\s*(\d{3,4})([a-zA-Z]?)/i);
    if (m) {
      named.add(
        `${m[1].toUpperCase()}${m[2]}n${m[3]}${(m[4] || '').toLowerCase()}`,
      );
    }
  }
  return named;
}

/**
 * Among phrase matches: prefer work codes named in the question, then best
 * primary genre tier, then top retrieval score (ties kept). No invented max-N.
 * Explicit work IDs are a hard filter — never fall through to another work.
 */
function refineScripturePhraseHits(
  phraseHits: CbetaChunkHit[],
  question: string,
  decision: CbetaRouteDecision,
): CbetaChunkHit[] {
  const deduped = dedupeByWork(phraseHits);
  if (deduped.length <= 1) {
    const named = explicitWorkCodes(question, decision);
    if (named.size && deduped.length === 1 && !named.has(deduped[0].workCode)) {
      return [];
    }
    return deduped;
  }

  const named = explicitWorkCodes(question, decision);
  if (named.size) {
    // Hard constraint: empty is honest (no matching passage in named works).
    return deduped.filter((h) => named.has(h.workCode));
  }

  const bestGenre = Math.max(...deduped.map(genrePriority));
  let pool = deduped.filter((h) => genrePriority(h) === bestGenre);
  if (!pool.length) pool = deduped;

  const tPool = pool.filter((h) => (h.collection || '').toUpperCase() === 'T');
  if (tPool.length) pool = tPool;

  // Prefer scripture-body titles (…經) over lectures that still mention 經.
  const body = pool.filter((h) => /經\s*$/.test((h.titleZh || '').trim()));
  if (body.length) pool = body;

  // Prefer titles matching vernacular/CJK scripture cues (Pháp Hoa→法華…).
  const cues = extractScriptureTitleCues(question);
  if (cues.length) {
    const bestAff = Math.max(
      ...pool.map((h) => titleCueAffinity(h.titleZh || '', cues)),
    );
    if (bestAff > 0) {
      const affPool = pool.filter(
        (h) => titleCueAffinity(h.titleZh || '', cues) === bestAff,
      );
      if (affPool.length) pool = affPool;
    }
  }

  const topScore = Math.max(...pool.map((h) => h.score));
  // Keep score ties only — avoids citing every commentary that reprints a phrase.
  return pool.filter((h) => h.score === topScore);
}

/**
 * When 2+ works are named: keep at least one phrase hit per work (if any),
 * so one work’s phrase cannot hide another requested work.
 */
function selectMultiWorkPhraseHits(
  hits: CbetaChunkHit[],
  phrases: string[],
  named: Set<string>,
): CbetaChunkHit[] {
  const long = [...phrases]
    .filter((n) => n.length >= 4)
    .sort((a, b) => b.length - a.length);
  const out: CbetaChunkHit[] = [];
  const seen = new Set<string>();
  for (const work of named) {
    const workHits = hits.filter((h) => h.workCode === work);
    let picked: CbetaChunkHit[] = [];
    for (const phrase of long) {
      const exact = workHits.filter((h) => hitHasPhrase(h.contentZh, phrase));
      if (exact.length) {
        // Already scoped to one work — keep phrase hits for that work only.
        picked = dedupeByWork(exact);
        break;
      }
    }
    if (!picked.length && workHits.length) {
      // No phrase: still keep best chunk from that work (multi-work coverage).
      picked = [workHits.slice().sort((a, b) => b.score - a.score)[0]];
    }
    for (const h of picked) {
      if (h && !seen.has(h.id)) {
        seen.add(h.id);
        out.push(h);
      }
    }
  }
  return out;
}

/** Prefer chunks that contain query CJK / parsed 法嗣 / exact scripture phrases. */
export function selectEvidenceHits(
  hits: CbetaChunkHit[],
  question: string,
  decision: CbetaRouteDecision,
): CbetaChunkHit[] {
  if (!hits.length) return [];
  const scripturePhrases = extractScripturePhraseNeedles(question);
  const needles = [
    ...scripturePhrases,
    ...extractPreservedCjk(question),
    ...extractPersonRelationNeedles(question),
  ].filter((n) => n.length >= 2);
  const uniq = [...new Set(needles)];

  const containsNeedle = (h: CbetaChunkHit) =>
    uniq.some((n) => h.contentZh.includes(n));

  // Scripture / quote / translate: ONLY chunks containing the longest phrases.
  // Never fall back to short needles (that floods unrelated works).
  const scriptureMode =
    decision.quoteVerifyMode ||
    decision.scriptureExplainMode ||
    isCbetaQuoteVerifyIntent(question) ||
    isCbetaScriptureExplainIntent(question) ||
    isCbetaTranslateIntent(question);

  if (scriptureMode || scripturePhrases.some((p) => p.length >= 6)) {
    const named = explicitWorkCodes(question, decision);
    if (named.size >= 2) {
      const multi = selectMultiWorkPhraseHits(hits, scripturePhrases, named);
      if (multi.length) return multi;
    }
    const long = [...scripturePhrases]
      .filter((n) => n.length >= 4)
      .sort((a, b) => b.length - a.length);
    for (const phrase of long) {
      const exact = hits.filter((h) => hitHasPhrase(h.contentZh, phrase));
      if (exact.length) {
        return refineScripturePhraseHits(exact, question, decision);
      }
    }
    // Gloss without long CJK: keep brief path below.
  }

  if (decision.personRelationMode) {
    const personNeedles = extractPersonRelationNeedles(question);
    const parsed = hits.filter((h) =>
      parsePersonFasuccessorBlock(h.contentZh, personNeedles),
    );
    if (parsed.length) return parsed;
    const matched = hits.filter(containsNeedle);
    if (matched.length) return matched;
    return hits;
  }

  if (decision.cbetaRefNeedle) {
    const bare = bareCbetaRef(decision.cbetaRefNeedle);
    const covering = hits.filter(
      (h) =>
        cbetaRefCovers(h.cbetaRefStart, h.cbetaRefStart, bare) ||
        (h.cbetaRefStart || '').includes(bare) ||
        (bare && h.contentZh.length > 0 && decision.workCodes.includes(h.workCode)),
    );
    // Prefer phrase match inside work constraint when available.
    const long = scripturePhrases.filter((p) => p.length >= 4);
    for (const phrase of long) {
      const exact = hits.filter((h) => h.contentZh.includes(phrase));
      if (exact.length) return exact;
    }
    if (covering.length) return covering;
  }

  const glossOrBrief =
    isCbetaBriefQuestion(question) ||
    /có nghĩa gì|nghĩa là gì|what does|chỉ số lượng|tối đa\s*\d+\s*câu/i.test(
      question,
    );

  if (glossOrBrief) {
    const long = uniq
      .filter((n) => /[\u3400-\u9fff]{6,}/u.test(n))
      .sort((a, b) => b.length - a.length);
    for (const phrase of long) {
      const exact = hits.filter((h) => h.contentZh.includes(phrase));
      if (exact.length) return exact;
    }
    // Prefer no false citations over short-needle flood.
    return [];
  }

  const cjkNeedles = uniq.filter((n) => /[\u3400-\u9fff]{4,}/u.test(n));
  if (cjkNeedles.length) {
    const matched = hits.filter((h) =>
      cjkNeedles.some((n) => h.contentZh.includes(n)),
    );
    if (matched.length) return matched;
  }
  return hits;
}

export function validateCbetaAnswer(input: {
  question: string;
  answer: string;
  decision: CbetaRouteDecision;
  evidenceHits: CbetaChunkHit[];
  citations: Array<{ workCode: string; chunkId: string }>;
}): string[] {
  const errors: string[] = [];
  const { question, answer, decision, evidenceHits, citations } = input;
  const ans = answer || '';

  if (decision.personRelationMode) {
    if (/Tây Thiên\s*\(西天\)|A\.\s*西天|Western lineage\s*\(西天\)/i.test(ans)) {
      errors.push('person_relation_looks_like_coverage_dump');
    }
    const needles = extractPersonRelationNeedles(question);
    const parsed = evidenceHits
      .map((h) => parsePersonFasuccessorBlock(h.contentZh, needles))
      .find((p) => p && p.names.length);
    if (parsed?.expectedCount != null && parsed.names.length) {
      const missing = parsed.names.filter((n) => !ans.includes(n));
      if (
        missing.length === parsed.names.length &&
        !new RegExp(String(parsed.expectedCount)).test(ans) &&
        !(parsed.countLabel && ans.includes(parsed.countLabel))
      ) {
        errors.push('person_relation_names_missing_from_answer');
      }
    }
  }

  if (decision.workCodes.length) {
    const allowed = new Set(decision.workCodes);
    const foreign = citations.filter((c) => c.workCode && !allowed.has(c.workCode));
    if (foreign.length && citations.length > 0 && foreign.length === citations.length) {
      errors.push('citations_ignore_work_constraint');
    }
  }

  if (decision.cbetaRefNeedle) {
    const bare = decision.cbetaRefNeedle.replace(/^p\.?/i, '');
    const hasLocator =
      ans.includes(bare) ||
      ans.includes(decision.cbetaRefNeedle) ||
      evidenceHits.some((h) => (h.cbetaRefStart || '').includes(bare));
    if (!hasLocator) {
      errors.push('locator_not_reflected');
    }
  }

  // Quote / explain: question phrases should appear in evidence when CJK-heavy.
  if (decision.quoteVerifyMode || decision.scriptureExplainMode) {
    const phraseClaims = verifyQuestionPhrasesAgainstEvidence(
      question,
      evidenceHits,
    );
    const unsupported = phraseClaims.filter(
      (c) => c.support_status === 'insufficient_evidence' && c.claim_text.length >= 6,
    );
    if (unsupported.length && !evidenceHits.length) {
      errors.push('scripture_phrase_not_in_evidence');
    }
    const { unsupportedQuotes } = verifyAnswerQuotesAgainstEvidence(
      ans,
      evidenceHits,
    );
    if (unsupportedQuotes.length) {
      errors.push(`unsupported_answer_quotes:${unsupportedQuotes.length}`);
    }
  }

  for (const c of citations) {
    if (!evidenceHits.some((h) => h.id === c.chunkId) && c.chunkId) {
      errors.push(`citation_not_in_evidence:${c.chunkId}`);
      break;
    }
  }

  return errors;
}
