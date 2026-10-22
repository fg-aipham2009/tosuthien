import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evidenceContainsPhrase,
  normalizeCjkForMatch,
  verifyQuestionPhrasesAgainstEvidence,
} from './cbeta-claim-verify.util';
import type { CbetaChunkHit } from './cbeta.types';

describe('evidenceContainsPhrase', () => {
  it('matches exact and punctuation-normalized forms', () => {
    const evidence = '色不異空。空不異色。色即是空。空即是色。';
    assert.equal(evidenceContainsPhrase(evidence, '色即是空。空即是色'), 'exact');
    assert.equal(
      evidenceContainsPhrase(evidence, '色即是空，空即是色'),
      'punct_normalized',
    );
    assert.ok(normalizeCjkForMatch('色即是空，空即是色').includes('色即是空空即是色'));
  });

  it('matches simplified needle via OpenCC against traditional evidence', () => {
    // 无 → 無 (OpenCC cn→tw); evidence uses traditional 無
    const evidence = '應無所住而生其心';
    const kind = evidenceContainsPhrase(evidence, '应无所住而生其心');
    assert.ok(
      kind === 'opencc_variant' || kind === 'exact' || kind === 'punct_normalized',
      `got ${kind}`,
    );
  });
});

describe('verifyQuestionPhrasesAgainstEvidence', () => {
  it('marks supported when phrase is in hits', () => {
    const hits: CbetaChunkHit[] = [
      {
        id: '1',
        workCode: 'T08n0251',
        collection: 'T',
        titleZh: '般若波羅蜜多心經',
        juanNo: 1,
        juanLabel: null,
        chunkIndex: 0,
        contentZh: '色即是空。空即是色。受想行識亦復如是。',
        score: 1,
        cbetaRefStart: '0848c14',
      },
    ];
    const records = verifyQuestionPhrasesAgainstEvidence(
      '色即是空，空即是色 nghĩa là gì?',
      hits,
    );
    assert.ok(records.length >= 1);
    assert.ok(
      records.some(
        (r) =>
          r.verified_as_verbatim &&
          (r.support_status === 'supported' ||
            r.support_status === 'partially_supported'),
      ),
    );
  });
});
