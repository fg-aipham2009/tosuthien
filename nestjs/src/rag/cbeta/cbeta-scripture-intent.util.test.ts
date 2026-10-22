import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { routeCbetaQuery } from './cbeta-router';
import {
  extractScripturePhraseNeedles,
  extractScriptureTitleCues,
  isCbetaQuoteVerifyIntent,
  isCbetaScriptureExplainIntent,
} from './cbeta-scripture-intent.util';
import { selectEvidenceHits } from './cbeta-evidence.util';
import type { CbetaChunkHit, CbetaRouteDecision } from './cbeta.types';

function baseDecision(
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
    scriptureExplainMode: false,
    scopeNote: '',
    reasons: [],
    ...over,
  };
}

describe('scripture / quote intents', () => {
  it('routes Heart Sutra explain off coverage', () => {
    const q =
      '色即是空，空即是色 có nghĩa là mọi thứ đều không tồn tại phải không?';
    assert.equal(isCbetaScriptureExplainIntent(q), true);
    const d = routeCbetaQuery({ question: q });
    assert.equal(d.scriptureExplainMode, true);
    assert.equal(d.coverageMode, false);
    assert.equal(d.personRelationMode, false);
  });

  it('routes quote verification', () => {
    const q = "Câu '色即是空，空即是色' có thật trong kinh không?";
    assert.equal(isCbetaQuoteVerifyIntent(q), true);
    const d = routeCbetaQuery({ question: q });
    assert.equal(d.quoteVerifyMode, true);
    assert.equal(d.scriptureExplainMode, false);
  });

  it('extracts long CJK phrases', () => {
    const needles = extractScripturePhraseNeedles(
      'Giải thích 應無所住而生其心 trong Kim Cang',
    );
    assert.ok(needles.some((n) => n.includes('應無所住')));
  });

  it('routes treatise attribution probes to scriptureExplain', () => {
    const q =
      '「眾因緣生法」trong Trung luận — lời Phật hay kệ Long Thọ?';
    assert.equal(isCbetaScriptureExplainIntent(q), true);
    const d = routeCbetaQuery({ question: q });
    assert.equal(d.scriptureExplainMode, true);
  });

  it('maps Pháp Hoa vernacular to 法華 title cues', () => {
    const cues = extractScriptureTitleCues(
      'Kinh Pháp Hoa nói「唯有一佛乘」nghĩa là gì?',
    );
    assert.ok(cues.includes('法華'));
  });
});

describe('selectEvidenceHits title cues', () => {
  it('prefers 法華經 over unrelated 經 when question says Pháp Hoa', () => {
    const hits: CbetaChunkHit[] = [
      {
        id: 'lotus',
        workCode: 'T09n0262',
        collection: 'T',
        titleZh: '妙法蓮華經',
        juanNo: 1,
        juanLabel: null,
        chunkIndex: 0,
        contentZh: '唯有一佛乘息處故說二',
        score: 800,
        cbetaRefStart: '0026a29',
      },
      {
        id: 'other',
        workCode: 'T85n2871',
        collection: 'T',
        titleZh: '大通方廣懺悔滅罪莊嚴成佛經',
        juanNo: 1,
        juanLabel: null,
        chunkIndex: 0,
        contentZh: '唯有一佛乘某某',
        score: 950,
        cbetaRefStart: '0001a01',
      },
    ];
    const selected = selectEvidenceHits(
      hits,
      'Kinh Pháp Hoa nói「唯有一佛乘」nghĩa là gì theo nguyên văn?',
      baseDecision({ scriptureExplainMode: true }),
    );
    assert.equal(selected.length, 1);
    assert.equal(selected[0].workCode, 'T09n0262');
  });
});

describe('selectEvidenceHits scripture fidelity', () => {
  it('keeps only chunks with the exact long phrase', () => {
    const hits: CbetaChunkHit[] = [
      {
        id: '1',
        workCode: 'T08n0251',
        collection: 'T',
        titleZh: '般若波羅蜜多心經',
        juanNo: 1,
        juanLabel: null,
        chunkIndex: 0,
        contentZh: '舍利子。色不異空。空不異色。色即是空。空即是色。',
        score: 1,
        cbetaRefStart: '0848c07',
      },
      {
        id: '2',
        workCode: 'T51n2076',
        collection: 'T',
        titleZh: '景德傳燈錄',
        juanNo: 1,
        juanLabel: null,
        chunkIndex: 0,
        contentZh: '傳燈錄雜文空有相對……',
        score: 0.9,
        cbetaRefStart: '0001a01',
      },
    ];
    const q = '色即是空，空即是色 có nghĩa là gì?';
    const selected = selectEvidenceHits(
      hits,
      q,
      baseDecision({ scriptureExplainMode: true }),
    );
    assert.equal(selected.length, 1);
    assert.equal(selected[0].workCode, 'T08n0251');
  });

  it('prefers 經 genre + top score over commentary reprints of the same phrase', () => {
    const hits: CbetaChunkHit[] = [
      {
        id: '疏',
        workCode: 'T33n1710',
        collection: 'T',
        titleZh: '般若波羅蜜多心經幽贊疏',
        juanNo: 1,
        juanLabel: null,
        chunkIndex: 0,
        contentZh: '疏曰色即是空空即是色',
        score: 900,
        cbetaRefStart: '0001a01',
      },
      {
        id: '經',
        workCode: 'T08n0251',
        collection: 'T',
        titleZh: '般若波羅蜜多心經',
        juanNo: 1,
        juanLabel: null,
        chunkIndex: 0,
        contentZh: '色即是空空即是色受想行識亦復如是',
        score: 880,
        cbetaRefStart: '0848c07',
      },
      {
        id: '經2',
        workCode: 'T08n0250',
        collection: 'T',
        titleZh: '摩訶般若波羅蜜大明咒經',
        juanNo: 1,
        juanLabel: null,
        chunkIndex: 0,
        contentZh: '色即是空空即是色',
        score: 870,
        cbetaRefStart: '0001a01',
      },
    ];
    const selected = selectEvidenceHits(
      hits,
      '色即是空，空即是色 có nghĩa là gì?',
      baseDecision({ scriptureExplainMode: true }),
    );
    assert.ok(selected.every((h) => /經/.test(h.titleZh)));
    assert.ok(selected.every((h) => !/疏|贊/.test(h.titleZh) || /經/.test(h.titleZh)));
    // Top score among 經 tier only (ties kept; here one winner).
    assert.equal(selected.length, 1);
    assert.equal(selected[0].workCode, 'T08n0251');
  });
});
