import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyDoctrinalGateToAnswer,
  runDoctrinalAttributionGate,
  scanDoctrinalRisks,
} from './cbeta-doctrinal-gate.util';
import type { CbetaChunkHit, CbetaRouteDecision } from './cbeta.types';

function decision(
  over: Partial<CbetaRouteDecision> = {},
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
    quoteVerifyMode: false,
    scriptureExplainMode: true,
    scopeNote: '',
    reasons: [],
    ...over,
  };
}

describe('scanDoctrinalRisks', () => {
  it('flags emptiness≈nonexistence affirmations', () => {
    const findings = scanDoctrinalRisks(
      '色即是空 có nghĩa là mọi thứ đều không tồn tại phải không?',
      'Đúng, mọi thứ đều không tồn tại.',
      [],
    );
    assert.ok(findings.some((f) => f.code === 'emptiness_as_nonexistence'));
  });
});

describe('runDoctrinalAttributionGate', () => {
  it('records unverified quotes as block findings when strict on', () => {
    process.env.CBETA_STRICT_VERIFY = '1';
    const hits: CbetaChunkHit[] = [
      {
        id: '1',
        workCode: 'T08n0251',
        collection: 'T',
        titleZh: '心經',
        juanNo: 1,
        juanLabel: null,
        chunkIndex: 0,
        contentZh: '色即是空。空即是色。',
        score: 1,
        cbetaRefStart: '0848c14',
      },
    ];
    const gate = runDoctrinalAttributionGate({
      question: 'giải thích',
      answer: 'Nguyên văn:「完全虛構魔說句XYZABC999」là lời Phật.',
      decision: decision(),
      evidenceHits: hits,
    });
    assert.equal(gate.enabled, true);
    assert.ok(gate.findings.some((f) => f.code === 'unverified_verbatim_quote'));
    const applied = applyDoctrinalGateToAnswer(
      'Nguyên văn:「完全虛構魔說句XYZABC999」là lời Phật.',
      gate,
    );
    assert.ok(applied.answer.includes('chưa xác minh') || applied.applied.length);
    delete process.env.CBETA_STRICT_VERIFY;
  });
});
