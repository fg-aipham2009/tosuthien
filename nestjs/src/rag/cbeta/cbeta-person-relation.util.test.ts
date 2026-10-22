import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { routeCbetaQuery } from './cbeta-router';
import {
  isCbetaCoverageIntent,
  isCbetaPersonRelationIntent,
} from './cbeta-intent.util';
import {
  formatFasuccessorHeadingGloss,
  isCbetaGlossOnlyQuestion,
  isCbetaPersonRelationQuestion,
  parsePersonFasuccessorBlock,
} from './cbeta-person-relation.util';

const YUNYAN_CHUNK =
  '漸源仲興禪師祿清和尚（已上三人見錄）潭州雲巖曇晟禪師法嗣四人筠州洞山良价禪師涿州杏山鑒洪禪師潭州神山僧密禪師幽谿和尚（已上四人見錄）華亭船子德誠禪師法嗣一人澧州夾山善會禪師（一人見錄）';

describe('person relation intent vs coverage', () => {
  it('routes Dharma successors of one person off coverage dump', () => {
    const qs = [
      'According to 景德傳燈錄 (T51n2076), how many Dharma successors (法嗣) did 雲巖曇晟 have? List their names and cite the original CBETA passage.',
      'Theo T51n2076, liệt kê pháp tự của 雲巖曇晟 và trích nguyên văn CBETA.',
      'From T51n2076 volume 15, locator T51n2076_p0317a22: 潭州雲巖曇晟禪師法嗣四人. List only the four Dharma successors.',
    ];
    for (const q of qs) {
      assert.equal(isCbetaPersonRelationIntent(q), true, q);
      assert.equal(isCbetaCoverageIntent(q), false, q);
      const d = routeCbetaQuery({ question: q });
      assert.equal(d.personRelationMode, true, q);
      assert.equal(d.coverageMode, false, q);
    }
  });

  it('keeps document-wide patriarch enumeration on coverage', () => {
    const q = 'Liệt kê các vị tổ trong truyền đăng lục';
    assert.equal(isCbetaPersonRelationQuestion(q), false);
    assert.equal(isCbetaCoverageIntent(q), true);
    assert.equal(routeCbetaQuery({ question: q }).coverageMode, true);
  });

  it('does not treat gloss/translate of 法嗣四人 as person-relation list', () => {
    const q =
      "Cụm Hán văn '潭州雲巖曇晟禪師法嗣四人' có nghĩa gì? Chữ '四人' chỉ số lượng bao nhiêu? Chỉ trả lời trong tối đa 2 câu.";
    assert.equal(isCbetaPersonRelationIntent(q), false);
    assert.equal(routeCbetaQuery({ question: q }).personRelationMode, false);
  });
});

describe('isCbetaGlossOnlyQuestion', () => {
  it('detects C3-style gloss of embedded 法嗣 heading', () => {
    const q =
      "Cụm Hán văn '潭州雲巖曇晟禪師法嗣四人' có nghĩa gì? Chữ '四人' chỉ số lượng bao nhiêu? Chỉ trả lời trong tối đa 2 câu.";
    assert.equal(isCbetaGlossOnlyQuestion(q), true);
  });
});

describe('formatFasuccessorHeadingGloss', () => {
  it('answers count without listing successors', () => {
    const q =
      "Cụm Hán văn '潭州雲巖曇晟禪師法嗣四人' có nghĩa gì? Chữ '四人' chỉ số lượng bao nhiêu? Chỉ trả lời trong tối đa 2 câu.";
    const ans = formatFasuccessorHeadingGloss(q);
    assert.ok(ans);
    assert.match(ans!, /4/);
    assert.doesNotMatch(ans!, /洞山良价/);
  });
});

describe('parsePersonFasuccessorBlock', () => {
  it('extracts four Yunyan successors and stops before next heading', () => {
    const parsed = parsePersonFasuccessorBlock(YUNYAN_CHUNK, [
      '雲巖曇晟',
      '潭州雲巖曇晟禪師法嗣四人',
    ]);
    assert.ok(parsed);
    assert.match(parsed!.heading, /雲巖曇晟禪師法嗣四人/);
    assert.equal(parsed!.expectedCount, 4);
    assert.deepEqual(parsed!.names, [
      '筠州洞山良价禪師',
      '涿州杏山鑒洪禪師',
      '潭州神山僧密禪師',
      '幽谿和尚',
    ]);
    assert.ok(!parsed!.evidenceSpan.includes('船子德誠'));
  });
});
