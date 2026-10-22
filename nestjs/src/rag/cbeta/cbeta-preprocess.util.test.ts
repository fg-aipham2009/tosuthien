import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  coverageTitleHintRegex,
  diversifyCbetaHits,
  enrichCbetaSearchZh,
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

  it('narrows bare "theo truyền đăng" to Jingde (not 7 *傳燈* works)', () => {
    assert.equal(
      coverageTitleHintRegex('Kể tên các tổ sư Thiền theo truyền đăng'),
      '景德傳燈',
    );
    assert.equal(coverageTitleHintRegex('tổ sư truyền đăng'), '景德傳燈');
    const re = new RegExp(
      coverageTitleHintRegex('theo truyền đăng')!,
      'u',
    );
    const titles = [
      '景德傳燈錄',
      '續傳燈錄',
      '增集續傳燈錄',
      '傳燈玉英集（殘卷）',
      '續傳燈錄目錄',
      '東域傳燈目錄',
      '日本佛教目錄學的形成——以《東域傳燈錄》為中心',
    ];
    assert.deepEqual(
      titles.filter((t) => re.test(t)),
      ['景德傳燈錄'],
    );
  });

  it('uses 續傳燈 when user asks tục truyền đăng', () => {
    assert.equal(coverageTitleHintRegex('tục truyền đăng lục'), '續傳燈');
    assert.equal(coverageTitleHintRegex('續傳燈錄'), '續傳燈');
  });

  it('maps ngũ đăng / chỉ nguyệt / phổ đăng / thế phổ', () => {
    assert.equal(
      coverageTitleHintRegex('liệt kê trong ngũ đăng hội nguyên'),
      '五燈會元',
    );
    assert.equal(coverageTitleHintRegex('chỉ nguyệt lục'), '指月');
    assert.equal(
      coverageTitleHintRegex('Gia Thái Phổ Đăng Lục'),
      '嘉泰普燈錄',
    );
    assert.equal(coverageTitleHintRegex('Thiền Đăng Thế Phổ'), '禪燈世譜');
  });

  it('prefers Ngũ Đăng over Jingde when both words appear', () => {
    assert.equal(
      coverageTitleHintRegex(
        'Liệt kê pháp tự Dương Kỳ theo Ngũ Đăng Hội Nguyên / truyền đăng CBETA',
      ),
      '五燈會元',
    );
    assert.equal(
      coverageTitleHintRegex('五燈會元與傳燈錄祖師'),
      '五燈會元',
    );
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

describe('enrichCbetaSearchZh', () => {
  it('appends Jingde / lineage anchors for patriarch list questions', () => {
    const { searchZh, keywords } = enrichCbetaSearchZh(
      'Liệt kê các vị tổ trong truyền đăng lục',
      '傳燈',
      [],
    );
    assert.match(searchZh, /景德傳燈錄/);
    assert.ok(keywords.some((k) => k.includes('景德') || k.includes('西天')));
  });

  it('leaves ordinary questions unchanged', () => {
    const { searchZh } = enrichCbetaSearchZh('thiền là gì', '禪 靜慮', []);
    assert.equal(searchZh, '禪 靜慮');
  });

  it('does not dump full lamp bag when user already named a work_code', () => {
    const { searchZh, keywords } = enrichCbetaSearchZh(
      'Trong T51n2076 nói gì về Tổ sư truyền pháp?',
      '祖師 傳法',
      ['T51n2076'],
    );
    assert.doesNotMatch(searchZh, /五燈會元/);
    assert.doesNotMatch(searchZh, /指月錄/);
    assert.ok(keywords.includes('傳法') || /傳法/.test(searchZh));
    assert.ok(keywords.includes('T51n2076'));
  });
});

describe('diversifyCbetaHits', () => {
  it('drops near-duplicate bodies and keeps score order across works', () => {
    const hits = diversifyCbetaHits([
      { workCode: 'A', contentZh: 'abc same body here', score: 1 },
      { workCode: 'B', contentZh: 'abc same body here', score: 9 },
      { workCode: 'A', contentZh: 'different passage text', score: 5 },
    ]);
    assert.equal(hits.length, 2);
    assert.equal(hits[0].workCode, 'B');
    assert.ok(hits.some((h) => h.contentZh.includes('different')));
  });
});
