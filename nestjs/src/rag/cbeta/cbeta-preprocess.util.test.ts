import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  coverageTitleHintRegex,
  isPatriarchListIntent,
} from './cbeta-preprocess.util';

describe('coverageTitleHintRegex', () => {
  it('narrows "truyền đăng lục" to 景德傳燈 (not every 傳燈 title)', () => {
    assert.equal(
      coverageTitleHintRegex('Liệt kê các vị tổ trong truyền đăng lục'),
      '景德傳燈',
    );
    assert.equal(coverageTitleHintRegex('trong Kinh truyền đăng lục'), '景德傳燈');
    assert.equal(coverageTitleHintRegex('景德傳燈錄祖師'), '景德傳燈');
  });

  it('uses 續傳燈 when user asks tục truyền đăng', () => {
    assert.equal(coverageTitleHintRegex('tục truyền đăng lục'), '續傳燈');
    assert.equal(coverageTitleHintRegex('續傳燈錄'), '續傳燈');
  });

  it('maps ngũ đăng / chỉ nguyệt', () => {
    assert.equal(coverageTitleHintRegex('liệt kê trong ngũ đăng hội nguyên'), '五燈');
    assert.equal(coverageTitleHintRegex('chỉ nguyệt lục'), '指月');
  });

  it('returns null when no specific chronicle named', () => {
    assert.equal(coverageTitleHintRegex('thiền là gì'), null);
    assert.equal(coverageTitleHintRegex('how practice chan'), null);
  });
});

describe('isPatriarchListIntent', () => {
  it('matches liệt kê các vị tổ / truyền đăng', () => {
    assert.equal(
      isPatriarchListIntent('Liệt kê các vị tổ trong truyền đăng lục'),
      true,
    );
    assert.equal(isPatriarchListIntent('các vị tổ sư thiền'), true);
  });

  it('rejects unrelated questions', () => {
    assert.equal(isPatriarchListIntent('thiền là gì'), false);
    assert.equal(isPatriarchListIntent('how practice chan'), false);
  });
});

describe('title hint filters work list like retrieveDeep', () => {
  it('keeps only Jingde among mixed 傳燈 titles', () => {
    const hint = coverageTitleHintRegex(
      'Liệt kê các vị tổ trong truyền đăng lục',
    );
    assert.ok(hint);
    const re = new RegExp(hint!, 'u');
    const titles = [
      '景德傳燈錄',
      '續傳燈錄',
      '傳燈玉英集（殘卷）',
      '五燈會元',
      '高僧傳',
    ];
    const kept = titles.filter((t) => re.test(t));
    assert.deepEqual(kept, ['景德傳燈錄']);
  });
});
