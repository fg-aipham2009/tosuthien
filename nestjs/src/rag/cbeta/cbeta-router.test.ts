import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aliasMatchesQuestion, routeCbetaQuery } from './cbeta-router';

describe('routeCbetaQuery', () => {
  it('routes list/patriarch questions to deep + coverageMode', () => {
    const d = routeCbetaQuery({
      question: 'Liệt kê các vị tổ trong truyền đăng lục',
    });
    assert.equal(d.path, 'deep');
    assert.equal(d.coverageMode, true);
    assert.ok(d.reasons.some((r) => r.includes('coverage')));
  });

  it('keeps ordinary VI questions on fast path', () => {
    const d = routeCbetaQuery({ question: 'thiền là gì' });
    assert.equal(d.path, 'fast');
    assert.equal(d.coverageMode, false);
  });

  it('respects forcePath=fast even for list questions', () => {
    const d = routeCbetaQuery({
      question: 'Liệt kê các vị tổ trong truyền đăng lục',
      forcePath: 'fast',
    });
    assert.equal(d.path, 'fast');
  });

  it('applies collection aliases from DB-shaped input', () => {
    const d = routeCbetaQuery({
      question: 'hỏi trong Tục Tạng',
      aliases: [{ code: 'X', alias: 'Tục Tạng' }],
    });
    assert.deepEqual(d.collections, ['X']);
  });
});

describe('aliasMatchesQuestion', () => {
  it('matches CJK substring and flexible VI whitespace', () => {
    assert.equal(aliasMatchesQuestion('讀續藏', '續藏'), true);
    assert.equal(aliasMatchesQuestion('hỏi Tục  Tạng hôm nay', 'Tục Tạng'), true);
    assert.equal(aliasMatchesQuestion('thiền là gì', 'Tục Tạng'), false);
  });
});
