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
});

describe('isPlausibleMasterName / filterCoverageEntities', () => {
  it('rejects stop names and odd fragments', () => {
    assert.equal(isPlausibleMasterName('諸佛'), false);
    assert.equal(isPlausibleMasterName('比丘'), false);
    assert.equal(isPlausibleMasterName('a'), false);
    assert.equal(isPlausibleMasterName('迦葉'), true);
    assert.equal(isPlausibleMasterName('慧能'), true);
  });

  it('drops stop names and keeps masters ordered by count', () => {
    const filtered = filterCoverageEntities([
      { nameZh: '諸佛', count: 99, works: ['T51n2076'] },
      { nameZh: '慧能', count: 5, works: ['T51n2076'] },
      { nameZh: '比丘', count: 80, works: ['T51n2076'] },
      { nameZh: '迦葉', count: 12, works: ['T51n2076'] },
    ]);
    assert.deepEqual(
      filtered.map((e) => e.nameZh),
      ['迦葉', '慧能'],
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
