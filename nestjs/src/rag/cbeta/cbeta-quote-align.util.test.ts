import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findAlignedEvidenceSpan,
  repairAnswerQuotesFromEvidence,
} from './cbeta-quote-align.util';
import { locateQuoteInHit } from './cbeta-quote-locator.util';
import type { CbetaChunkHit } from './cbeta.types';

describe('quote align / locator', () => {
  it('restores missing 得 from evidence span', () => {
    const evidence =
      '色無常。無常即是苦。苦即非我。非我者即非我所。如是觀者名真實正觀。如是觀已。厭於色。厭故不樂。不樂故得解脫。';
    const aligned = findAlignedEvidenceSpan(evidence, '不樂故解脫');
    assert.ok(aligned);
    assert.equal(aligned!.span, '不樂故得解脫');
    assert.ok(
      aligned!.kind === 'near_span' || aligned!.kind === 'punct_normalized',
    );
  });

  it('repairs fenced answer quote to exact evidence', () => {
    const hits: CbetaChunkHit[] = [
      {
        id: 'c1',
        workCode: 'T02n0099',
        collection: 'T',
        titleZh: '雜阿含經',
        juanNo: 1,
        juanLabel: null,
        chunkIndex: 0,
        contentZh: '厭故不樂。不樂故得解脫。解脫知見。',
        score: 100,
        cbetaRefStart: 'T02n0099_p0001c03',
      },
    ];
    const { answer, repairs } = repairAnswerQuotesFromEvidence(
      'Kinh nói 「不樂故解脫」',
      hits,
    );
    assert.ok(answer.includes('不樂故得解脫'));
    assert.equal(repairs.length, 1);
  });

  it('locateQuoteInHit returns passage precision without inventing lineheads', () => {
    const hit: CbetaChunkHit = {
      id: 'c1',
      workCode: 'T09n0262',
      collection: 'T',
      titleZh: '妙法蓮華經',
      juanNo: 1,
      juanLabel: null,
      chunkIndex: 0,
      contentZh: '諸佛如來。唯以一大事因緣故。出現於世。',
      score: 100,
      cbetaRefStart: 'T09n0262_p0007a01',
    };
    const loc = locateQuoteInHit(hit, '唯以一大事因緣故');
    assert.ok(loc);
    assert.equal(loc!.locatorPrecision, 'passage');
    assert.equal(loc!.quoteStartLocator, 'T09n0262_p0007a01');
    assert.equal(loc!.evidenceSpan, '唯以一大事因緣故');
    assert.equal(loc!.workId, 'T09n0262');
  });

  it('does not invent a locator when quote absent', () => {
    const hit: CbetaChunkHit = {
      id: 'c1',
      workCode: 'T30n1564',
      collection: 'T',
      titleZh: '中論',
      juanNo: 1,
      juanLabel: null,
      chunkIndex: 0,
      contentZh: '不生亦不滅',
      score: 100,
      cbetaRefStart: 'T30n1564_p0001a01',
    };
    assert.equal(locateQuoteInHit(hit, '眾因緣生法'), null);
  });
});
