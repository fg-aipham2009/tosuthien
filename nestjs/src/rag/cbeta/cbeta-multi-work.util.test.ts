import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  explicitWorkCodes,
  selectEvidenceHits,
} from './cbeta-evidence.util';
import type { CbetaChunkHit, CbetaRouteDecision } from './cbeta.types';

function hit(
  partial: Partial<CbetaChunkHit> & Pick<CbetaChunkHit, 'id' | 'workCode' | 'contentZh'>,
): CbetaChunkHit {
  return {
    collection: 'T',
    titleZh: 'test',
    juanNo: 1,
    juanLabel: null,
    chunkIndex: 0,
    score: 100,
    cbetaRefStart: 'p0001a01',
    ...partial,
  };
}

function decision(
  overrides: Partial<CbetaRouteDecision> = {},
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
    ...overrides,
  };
}

describe('explicit multi-work evidence', () => {
  it('does not substitute T08n0236a when T08n0235 is named', () => {
    const hits = [
      hit({
        id: 'a',
        workCode: 'T08n0236a',
        contentZh: '應無所住而生其心',
        titleZh: '金剛般若波羅蜜經',
        score: 900,
      }),
      hit({
        id: 'b',
        workCode: 'T08n0235',
        contentZh: ' unrelated ',
        titleZh: '金剛般若波羅蜜經',
        score: 50,
      }),
    ];
    const d = decision({ workCodes: ['T08n0235'] });
    const q = 'Giải T08n0235 câu 應無所住而生其心';
    const selected = selectEvidenceHits(hits, q, d);
    assert.ok(
      selected.every((h) => h.workCode === 'T08n0235'),
      'must not cite sister translation T08n0236a',
    );
  });

  it('keeps evidence from both T48n2007 and T48n2008 when both named', () => {
    const hits = [
      hit({
        id: '1',
        workCode: 'T48n2007',
        contentZh: '不立文字教外別傳',
        titleZh: '少室六門',
        score: 200,
      }),
      hit({
        id: '2',
        workCode: 'T48n2008',
        contentZh: '菩提本無樹',
        titleZh: '六祖壇經',
        score: 800,
      }),
    ];
    const d = decision({
      workCodes: ['T48n2007', 'T48n2008'],
      scriptureExplainMode: true,
    });
    const q =
      'So sánh T48n2007 và T48n2008 về 不立文字教外別傳 và 菩提本無樹';
    const selected = selectEvidenceHits(hits, q, d);
    const works = new Set(selected.map((h) => h.workCode));
    assert.ok(works.has('T48n2007'), 'must keep T48n2007');
    assert.ok(works.has('T48n2008'), 'must keep T48n2008');
  });

  it('parses explicit work codes from question', () => {
    const named = explicitWorkCodes(
      'Đối chiếu T51n2076 và T48n2005',
      decision({ workCodes: ['T51n2076'] }),
    );
    assert.ok(named.has('T51n2076'));
    assert.ok(named.has('T48n2005'));
  });
});
