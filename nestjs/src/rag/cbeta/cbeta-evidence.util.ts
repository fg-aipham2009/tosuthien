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
  isCbetaQuoteVerifyIntent,
  isCbetaScriptureExplainIntent,
  isCbetaTranslateIntent,
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
 * Among phrase matches: prefer work codes named in the question, then best
 * primary genre tier, then top retrieval score (ties kept). No invented max-N.
 */
function refineScripturePhraseHits(
  phraseHits: CbetaChunkHit[],
  question: string,
  decision: CbetaRouteDecision,
): CbetaChunkHit[] {
  const deduped = dedupeByWork(phraseHits);
  if (deduped.length <= 1) return deduped;

  const named = new Set(decision.workCodes);
  const fromQ =
    question.match(/T\d{2}n\d{4}[A-Za-z]?/gi) || [];
  for (const w of fromQ) named.add(w);
  if (named.size) {
    const constrained = deduped.filter((h) => named.has(h.workCode));
    if (constrained.length) return constrained;
  }

  const bestGenre = Math.max(...deduped.map(genrePriority));
  let pool = deduped.filter((h) => genrePriority(h) === bestGenre);
  if (!pool.length) pool = deduped;

  const tPool = pool.filter((h) => (h.collection || '').toUpperCase() === 'T');
  if (tPool.length) pool = tPool;

  // Prefer scripture-body titles (…經) over lectures that still mention 經.
  const body = pool.filter((h) => /經\s*$/.test((h.titleZh || '').trim()));
  if (body.length) pool = body;

  // Prefer titles that share CJK tokens with the question (法華/金剛/中論…).
  const qTokens = [
    ...new Set((question.match(/[\u3400-\u9fff]{2,8}/g) || []).filter((t) => t.length >= 2)),
  ];
  if (qTokens.length) {
    const affinity = (h: CbetaChunkHit) =>
      qTokens.reduce(
        (n, t) => n + ((h.titleZh || '').includes(t) ? t.length : 0),
        0,
      );
    const bestAff = Math.max(...pool.map(affinity));
    if (bestAff > 0) {
      const affPool = pool.filter((h) => affinity(h) === bestAff);
      if (affPool.length) pool = affPool;
    }
  }

  const topScore = Math.max(...pool.map((h) => h.score));
  // Keep score ties only — avoids citing every commentary that reprints a phrase.
  return pool.filter((h) => h.score === topScore);
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
