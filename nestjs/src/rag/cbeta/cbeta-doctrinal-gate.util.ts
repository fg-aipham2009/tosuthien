/**
 * Pre-response doctrinal attribution / misquote gate.
 * Deterministic heuristics only — records uncertainty; does not LLM-judge.
 * Gated by CBETA_STRICT_VERIFY=1 (or true/on/yes).
 */

import {
  extractAnswerCjkQuotes,
  type CbetaClaimRecord,
  verifyAnswerQuotesAgainstEvidence,
  verifyLocatorAgainstHits,
  verifyQuestionPhrasesAgainstEvidence,
} from './cbeta-claim-verify.util';
import { inferCbetaGenre } from './cbeta-genre.util';
import type { CbetaChunkHit, CbetaRouteDecision } from './cbeta.types';

export function cbetaStrictVerifyEnabled(): boolean {
  const v = (
    process.env.CBETA_STRICT_VERIFY ||
    process.env.CBETA_DOCTRINAL_GATE ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

export interface DoctrinalGateFinding {
  code: string;
  severity: 'block' | 'qualify' | 'info';
  message: string;
}

export interface DoctrinalGateResult {
  enabled: boolean;
  findings: DoctrinalGateFinding[];
  claims: CbetaClaimRecord[];
  /** When true, caller should strip/qualify unsupported verbatim claims. */
  mustQualify: boolean;
  /** When true, caller should refuse presenting unverified quotes as canonical. */
  blockUnsupportedVerbatim: boolean;
  /** Suggested preface when qualifying. */
  qualificationNote: string | null;
}

const OVERSIMPLIFY_EMPTY =
  /(?:mọi thứ|tất cả|everything).{0,24}(?:không tồn tại|does not exist|không có thật)|empty(?:ness)?\s+means\s+(?:nothing|non-?existence)|không\s*=\s*không tồn tại/i;

const OVERSIMPLIFY_ANATTA =
  /(?:vô ngã|non-?self|無我).{0,40}(?:hoàn toàn không tồn tại|completely (?:does not|don't) exist|con người không tồn tại)/i;

const OVERSIMPLIFY_WUJU =
  /(?:vô trụ|無住|應無所住).{0,40}(?:không cần (?:suy nghĩ|làm gì)|do nothing|stop thinking)/i;

const BUDDHA_SAID_ALL =
  /(?:đức phật|phật dạy|buddha (?:said|taught)|佛說|佛言).{0,60}(?:mọi kinh|all sutras|all traditions|一切經)/i;

const COMMENTARY_AS_SUTRA =
  /(?:trong kinh|sutra says|kinh phật dạy).{0,40}(?:疏|鈔|註|論曰)/i;

/**
 * Scan draft answer for high-risk unsupported doctrinal patterns.
 */
export function scanDoctrinalRisks(
  question: string,
  answer: string,
  hits: CbetaChunkHit[],
): DoctrinalGateFinding[] {
  const findings: DoctrinalGateFinding[] = [];
  const ans = answer || '';
  const q = question || '';

  if (OVERSIMPLIFY_EMPTY.test(q) && /đúng|phải|yes|indeed|means that everything does not exist/i.test(ans) && !/không phải|không có nghĩa|rejects|bác bỏ|không đồng nhất/i.test(ans)) {
    findings.push({
      code: 'emptiness_as_nonexistence',
      severity: 'qualify',
      message:
        'Answer may affirm emptiness≈nonexistence; require contextual qualification from evidence.',
    });
  }
  if (OVERSIMPLIFY_ANATTA.test(ans) && !/không phải|không đồng nhất|conventional|giả danh|chế định/i.test(ans)) {
    findings.push({
      code: 'anatta_as_annihilation',
      severity: 'qualify',
      message:
        'Answer may collapse non-self into annihilation of conventional persons.',
    });
  }
  if (OVERSIMPLIFY_WUJU.test(ans) && !/không phải|không có nghĩa|bác|rejects/i.test(ans)) {
    findings.push({
      code: 'wuju_as_inaction',
      severity: 'qualify',
      message:
        'Answer may reduce 應無所住 to “do nothing / stop thinking”.',
    });
  }
  if (BUDDHA_SAID_ALL.test(ans)) {
    findings.push({
      code: 'universalize_one_school',
      severity: 'qualify',
      message:
        'Answer may universalize one teaching to all sutras/traditions without evidence.',
    });
  }

  // Commentary genre presented as direct Buddha speech.
  const hasCommentary = hits.some((h) => {
    const g = inferCbetaGenre({
      titleZh: h.titleZh,
      collection: h.collection,
      workCode: h.workCode,
    });
    return g === '疏' || g === '鈔' || g === '註' || g === '論';
  });
  const claimsBuddha =
    /đức phật (?:dạy|nói)|buddha (?:said|taught)|佛说|佛說|世尊曰/i.test(ans);
  if (hasCommentary && claimsBuddha && COMMENTARY_AS_SUTRA.test(ans)) {
    findings.push({
      code: 'commentary_as_buddha_speech',
      severity: 'block',
      message:
        'Commentary evidence attributed as direct Buddha/sutra speech.',
    });
  } else if (
    hasCommentary &&
    claimsBuddha &&
    !hits.some((h) => inferCbetaGenre({ titleZh: h.titleZh }) === '經')
  ) {
    findings.push({
      code: 'buddha_speech_without_sutra_hit',
      severity: 'qualify',
      message:
        'Buddha-speech claim without a retrieved 經 hit — qualify attribution.',
    });
  }

  return findings;
}

/**
 * Full gate: phrase/locator/quote verification + doctrinal risk scan.
 */
export function runDoctrinalAttributionGate(input: {
  question: string;
  answer: string;
  decision: CbetaRouteDecision;
  evidenceHits: CbetaChunkHit[];
}): DoctrinalGateResult {
  const enabled = cbetaStrictVerifyEnabled();
  const { question, answer, decision, evidenceHits } = input;
  const claims: CbetaClaimRecord[] = [
    ...verifyQuestionPhrasesAgainstEvidence(question, evidenceHits),
    ...verifyAnswerQuotesAgainstEvidence(answer, evidenceHits).records,
  ];
  if (decision.cbetaRefNeedle) {
    claims.push(
      verifyLocatorAgainstHits(
        decision.cbetaRefNeedle,
        decision.workCodes,
        evidenceHits,
      ),
    );
  }

  const findings = scanDoctrinalRisks(question, answer, evidenceHits);
  const { unsupportedQuotes } = verifyAnswerQuotesAgainstEvidence(
    answer,
    evidenceHits,
  );
  for (const q of unsupportedQuotes) {
    findings.push({
      code: 'unverified_verbatim_quote',
      severity: 'block',
      message: `Unverified verbatim-looking quote not found in evidence: ${q.slice(0, 40)}`,
    });
  }

  // Scripture modes: question phrase missing from evidence → qualify.
  if (
    (decision.quoteVerifyMode || decision.scriptureExplainMode) &&
    claims.some(
      (c) =>
        c.claim_type === 'exact_quote' &&
        c.claim_id.startsWith('qphrase_') &&
        c.support_status === 'insufficient_evidence' &&
        c.claim_text.length >= 6,
    )
  ) {
    findings.push({
      code: 'question_phrase_not_in_evidence',
      severity: 'qualify',
      message:
        'Asked CJK phrase was not located in selected evidence — answer must state limitation.',
    });
  }

  const blockUnsupportedVerbatim = findings.some(
    (f) => f.severity === 'block' && f.code === 'unverified_verbatim_quote',
  );
  const mustQualify =
    enabled &&
    findings.some((f) => f.severity === 'block' || f.severity === 'qualify');

  let qualificationNote: string | null = null;
  if (mustQualify) {
    qualificationNote =
      '【Ghi chú kiểm chứng】Một số khẳng định chưa khớp đủ nguyên văn/ngữ cảnh CBETA đã chọn; chỉ giữ phần có bằng chứng, phần còn lại là suy luận có giới hạn — không coi là nguyên văn đã xác minh.';
  }

  return {
    enabled,
    findings: enabled ? findings : findings.map((f) => ({ ...f, severity: 'info' as const })),
    claims,
    mustQualify,
    blockUnsupportedVerbatim: enabled && blockUnsupportedVerbatim,
    qualificationNote: enabled ? qualificationNote : null,
  };
}

/**
 * Strip fenced CJK quotes from answer that failed verification.
 * Leaves surrounding prose; marks removed spans.
 */
export function stripUnverifiedVerbatimQuotes(
  answer: string,
  unsupportedQuotes: string[],
): string {
  let out = answer || '';
  for (const q of unsupportedQuotes) {
    if (!q || q.length < 4) continue;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(
      new RegExp(`[「『"“]?${escaped}[」』"”]?`, 'g'),
      '〔trích dẫn chưa xác minh — đã ẩn〕',
    );
  }
  return out;
}

export function applyDoctrinalGateToAnswer(
  answer: string,
  gate: DoctrinalGateResult,
): { answer: string; applied: string[] } {
  const applied: string[] = [];
  if (!gate.enabled) return { answer, applied };
  let out = answer;
  if (gate.blockUnsupportedVerbatim) {
    const quotes = extractAnswerCjkQuotes(answer);
    const bad = quotes.filter((q) =>
      gate.findings.some(
        (f) =>
          f.code === 'unverified_verbatim_quote' && f.message.includes(q.slice(0, 20)),
      ),
    );
    // Prefer unsupported list from claims
    const fromClaims = gate.claims
      .filter(
        (c) =>
          c.claim_type === 'exact_quote' &&
          c.support_status === 'unsupported' &&
          c.verified_as_verbatim === false,
      )
      .map((c) => c.claim_text);
    const stripList = [...new Set([...bad, ...fromClaims])];
    if (stripList.length) {
      out = stripUnverifiedVerbatimQuotes(out, stripList);
      applied.push('strip_unverified_quotes');
    }
  }
  if (gate.mustQualify && gate.qualificationNote) {
    if (!out.includes('【Ghi chú kiểm chứng】')) {
      out = `${out.trim()}\n\n${gate.qualificationNote}`;
      applied.push('qualification_note');
    }
  }
  return { answer: out, applied };
}
