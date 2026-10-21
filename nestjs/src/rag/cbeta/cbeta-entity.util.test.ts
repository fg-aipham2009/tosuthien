import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractMasterNames,
  filterCoverageEntities,
  isPlausibleMasterName,
  lexicalOverlapScore,
} from './cbeta-entity.util';

describe('extractMasterNames', () => {
  it('extracts 禪師 / 和尚 / 大師 names', () => {
    const names = extractMasterNames('時有玄奘禪師、南嶽懷讓和尚、馬祖道一大師問答');
    assert.ok(names.includes('玄奘'));
    assert.ok(names.includes('南嶽懷讓') || names.includes('懷讓'));
    assert.ok(names.includes('馬祖道一') || names.includes('道一'));
  });

  it('skips stop names like 諸佛 / 比丘', () => {
    const names = extractMasterNames('諸佛禪師與比丘和尚共會');
    assert.ok(!names.includes('諸佛'));
    assert.ok(!names.includes('比丘'));
  });

  it('does not treat dialogue glue as a master name', () => {
    const names = extractMasterNames(
      '問如何是禪師。曰未審和尚。便請大師開示。如何是禪師意。某甲不道禪師。',
    );
    assert.ok(!names.includes('問如何是'));
    assert.ok(!names.includes('如何是'));
    assert.ok(!names.includes('曰未審'));
    assert.ok(!names.includes('便請'));
    assert.ok(!names.includes('某甲不道'));
    assert.ok(!names.includes('今請'));
  });

  it('does not emit truncated geo heads like 州白雲祥', () => {
    const names = extractMasterNames(
      '時有撫州白雲祥禪師示眾。又有洪州百丈懷海和尚。',
    );
    assert.ok(!names.some((n) => n.startsWith('州')));
    assert.ok(
      names.includes('白雲祥') ||
        names.includes('撫州白雲祥') ||
        names.includes('雲祥'),
    );
    assert.ok(
      names.includes('百丈懷海') ||
        names.includes('懷海') ||
        names.includes('丈懷海'),
    );
  });
});

describe('isPlausibleMasterName / filterCoverageEntities', () => {
  it('rejects stop names and odd fragments', () => {
    assert.equal(isPlausibleMasterName('諸佛'), false);
    assert.equal(isPlausibleMasterName('比丘'), false);
    assert.equal(isPlausibleMasterName('a'), false);
    assert.equal(isPlausibleMasterName('問如何是'), false);
    assert.equal(isPlausibleMasterName('一祖道信'), false);
    assert.equal(isPlausibleMasterName('州白雲祥'), false);
    assert.equal(isPlausibleMasterName('今請'), false);
    assert.equal(isPlausibleMasterName('莫便是'), false);
    assert.equal(isPlausibleMasterName('某甲不道'), false);
    assert.equal(isPlausibleMasterName('迦葉'), true);
    assert.equal(isPlausibleMasterName('慧能'), true);
    assert.equal(isPlausibleMasterName('不如密多'), true);
  });

  it('drops stop names and keeps masters ordered by count', () => {
    const filtered = filterCoverageEntities([
      { nameZh: '諸佛', count: 99, works: ['T51n2076'] },
      { nameZh: '慧能', count: 5, works: ['T51n2076'] },
      { nameZh: '比丘', count: 80, works: ['T51n2076'] },
      { nameZh: '迦葉', count: 12, works: ['T51n2076'] },
      { nameZh: '州白雲祥', count: 40, works: ['T51n2076'] },
      { nameZh: '今請', count: 30, works: ['T51n2076'] },
    ]);
    assert.deepEqual(
      filtered.map((e) => e.nameZh),
      ['迦葉', '慧能'],
    );
  });

  it('minCount drops one-off appendix noise', () => {
    const filtered = filterCoverageEntities(
      [
        { nameZh: '慧能', count: 1, works: ['T51n2076'] },
        { nameZh: '懷讓', count: 3, works: ['T51n2076'] },
      ],
      { minCount: 2 },
    );
    assert.deepEqual(
      filtered.map((e) => e.nameZh),
      ['懷讓'],
    );
  });
});

describe('lexicalOverlapScore', () => {
  it('scores higher when more CJK overlap', () => {
    const q = '景德傳燈錄祖師';
    const high = lexicalOverlapScore(q, '景德傳燈錄載西天東土祖師');
    const low = lexicalOverlapScore(q, '阿彌陀經往生淨土');
    assert.ok(high > low);
  });
});
