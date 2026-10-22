/**
 * Regression coverage for the seven CBETA eval cases (unit-level).
 * Does not claim end-to-end gold scores — only deterministic helpers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCbetaCitationHints } from './cbeta-query-parse.util';
import {
  explicitWorkCodes,
  selectEvidenceHits,
} from './cbeta-evidence.util';
import {
  evidenceContainsPhrase,
  extractAnswerCjkQuotes,
  verifyAnswerQuotesAgainstEvidence,
} from './cbeta-claim-verify.util';
import { findAlignedEvidenceSpan } from './cbeta-quote-align.util';
import { locateQuoteInHits } from './cbeta-quote-locator.util';
import {
  applyDoctrinalGateToAnswer,
  runDoctrinalAttributionGate,
} from './cbeta-doctrinal-gate.util';
import type { CbetaChunkHit, CbetaRouteDecision } from './cbeta.types';

function baseDecision(
  o: Partial<CbetaRouteDecision> = {},
): CbetaRouteDecision {
  return {
    corpus: 'cbeta',
    resolvedCorpus: 'cbeta',
    path: 'fast',
    collections: [],
    workCodes: [],
    juanNo: null,
    cbetaRefNeedle: null,
    coverageMode: false,
    sectionListMode: false,
    schoolLineageMode: false,
    personRelationMode: false,
    quoteVerifyMode: true,
    scriptureExplainMode: false,
    scopeNote: '',
    reasons: [],
    ...o,
  };
}

function hit(
  o: Partial<CbetaChunkHit> & Pick<CbetaChunkHit, 'id' | 'workCode' | 'contentZh'>,
): CbetaChunkHit {
  return {
    collection: 'T',
    titleZh: '',
    juanNo: 1,
    juanLabel: null,
    chunkIndex: 0,
    score: 100,
    cbetaRefStart: null,
    ...o,
  };
}

describe('seven-case regression (helpers)', () => {
  it('case01: T08n0235 hard constraint — no T08n0236a substitute', () => {
    const q = 'T08n0235 應無所住而生其心 nghĩa gì?';
    const hints = parseCbetaCitationHints(q);
    assert.deepEqual(hints.workCodes, ['T08n0235']);
    const selected = selectEvidenceHits(
      [
        hit({
          id: '236',
          workCode: 'T08n0236a',
          contentZh: '應無所住而生其心',
          score: 999,
        }),
        hit({
          id: '235',
          workCode: 'T08n0235',
          contentZh: '其他',
          score: 10,
        }),
      ],
      q,
      baseDecision({
        workCodes: hints.workCodes,
        scriptureExplainMode: true,
        quoteVerifyMode: false,
      }),
    );
    assert.ok(selected.every((h) => h.workCode === 'T08n0235'));
  });

  it('case02: T30n1564 locator stays on chunk containing the verse', () => {
    const hits = [
      hit({
        id: 'v',
        workCode: 'T30n1564',
        contentZh: '眾因緣生法。我說即是無。亦為是假名。亦是中道義。',
        cbetaRefStart: 'T30n1564_p0033b11',
      }),
    ];
    const loc = locateQuoteInHits(hits, '眾因緣生法');
    assert.ok(loc);
    assert.equal(loc!.workId, 'T30n1564');
    assert.equal(loc!.locatorPrecision, 'passage');
    assert.ok(loc!.evidenceSpan.includes('眾因緣生法'));
  });

  it('case03: T09n0262 phrase maps to containing chunk', () => {
    const hits = [
      hit({
        id: 'early',
        workCode: 'T09n0262',
        contentZh: '如是我聞',
        cbetaRefStart: 'T09n0262_p0001a01',
        score: 50,
      }),
      hit({
        id: 'target',
        workCode: 'T09n0262',
        contentZh: '唯以一大事因緣故。出現於世。',
        cbetaRefStart: 'T09n0262_p0007a21',
        score: 200,
      }),
    ];
    const loc = locateQuoteInHits(hits, '一大事因緣');
    assert.equal(loc?.chunkStartLocator, 'T09n0262_p0007a21');
  });

  it('case04: verbatim fidelity — align missing character from evidence', () => {
    const aligned = findAlignedEvidenceSpan(
      '不樂故得解脫',
      '不樂故解脫',
    );
    assert.equal(aligned?.span, '不樂故得解脫');
  });

  it('case05: valid quote in evidence is not unsupported', () => {
    const hits = [
      hit({
        id: 'cat',
        workCode: 'T51n2076',
        contentZh: '道得即救取猫兒。否則斬卻也。師便斬之。',
        cbetaRefStart: 'T51n2076_p0258a01',
        juanNo: 8,
      }),
    ];
    const answer = '「道得即救取猫兒」「師便斬之」';
    const { unsupportedQuotes } = verifyAnswerQuotesAgainstEvidence(
      answer,
      hits,
    );
    assert.equal(unsupportedQuotes.length, 0);
    const quotes = extractAnswerCjkQuotes(answer);
    assert.ok(quotes.includes('道得即救取猫兒'));
  });

  it('case06: multi-work T51n2076 + T48n2005 both retained', () => {
    const q = 'So sánh T51n2076 và T48n2005: 道不屬知不知';
    const named = explicitWorkCodes(
      q,
      baseDecision({ workCodes: ['T51n2076', 'T48n2005'] }),
    );
    assert.ok(named.has('T51n2076') && named.has('T48n2005'));
    const selected = selectEvidenceHits(
      [
        hit({
          id: 'a',
          workCode: 'T51n2076',
          contentZh: '道不屬知不知',
          score: 300,
        }),
        hit({
          id: 'b',
          workCode: 'T48n2005',
          contentZh: '不擬時如何知是道',
          score: 100,
        }),
      ],
      'T51n2076 T48n2005 道不屬知不知 不擬時如何知是道',
      baseDecision({
        workCodes: ['T51n2076', 'T48n2005'],
        scriptureExplainMode: true,
        quoteVerifyMode: false,
      }),
    );
    const works = new Set(selected.map((h) => h.workCode));
    assert.ok(works.has('T51n2076'));
    assert.ok(works.has('T48n2005'));
  });

  it('case07: parse both T48n2007 and T48n2008', () => {
    const hints = parseCbetaCitationHints(
      'Đối chiếu T48n2007 với T48n2008',
    );
    assert.ok(hints.workCodes.includes('T48n2007'));
    assert.ok(hints.workCodes.includes('T48n2008'));
  });

  it('fabricated quote remains unsupported / stripped under STRICT_VERIFY', () => {
    const prev = process.env.CBETA_STRICT_VERIFY;
    process.env.CBETA_STRICT_VERIFY = '1';
    try {
      const hits = [
        hit({
          id: 'x',
          workCode: 'T08n0235',
          contentZh: '應無所住而生其心',
        }),
      ];
      const answer = '「完全虛構的經文句子啊啊」';
      assert.equal(evidenceContainsPhrase(hits[0].contentZh, '完全虛構的經文句子啊啊'), 'none');
      const gate = runDoctrinalAttributionGate({
        question: 'T08n0235',
        answer,
        decision: baseDecision({ workCodes: ['T08n0235'] }),
        evidenceHits: hits,
      });
      const applied = applyDoctrinalGateToAnswer(answer, gate);
      assert.ok(applied.answer.includes('尚未 xác minh') || applied.answer.includes('chưa xác minh') || applied.applied.includes('strip_unverified_quotes'));
    } finally {
      if (prev === undefined) delete process.env.CBETA_STRICT_VERIFY;
      else process.env.CBETA_STRICT_VERIFY = prev;
    }
  });
});
