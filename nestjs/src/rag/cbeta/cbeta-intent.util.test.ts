import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cbetaEmptyHitMessage,
  detectCbetaAnswerLang,
  isCbetaBriefQuestion,
  isCbetaCoverageIntent,
  isCbetaSchoolLineageIntent,
  isCbetaSectionListIntent,
} from './cbeta-intent.util';

describe('detectCbetaAnswerLang', () => {
  it('prefers Vietnamese when diacritics present', () => {
    assert.equal(detectCbetaAnswerLang('thiền là gì'), 'vi');
    assert.equal(
      detectCbetaAnswerLang('Liệt kê các vị tổ trong truyền đăng lục'),
      'vi',
    );
  });

  it('prefers Vietnamese for unaccented VI cues (not English)', () => {
    assert.equal(detectCbetaAnswerLang('thien la gi'), 'vi');
    assert.equal(detectCbetaAnswerLang('tom gon yeu chi thien'), 'vi');
  });

  it('detects Chinese / Hán questions', () => {
    assert.equal(detectCbetaAnswerLang('禪是什麼'), 'zh');
    assert.equal(detectCbetaAnswerLang('禅是什么'), 'zh');
    assert.equal(detectCbetaAnswerLang('列出傳燈錄祖師'), 'zh');
  });

  it('detects clear English-only questions', () => {
    assert.equal(detectCbetaAnswerLang('how practice chan'), 'en');
    assert.equal(detectCbetaAnswerLang('What is Chan?'), 'en');
    assert.equal(detectCbetaAnswerLang('explain koan briefly'), 'en');
  });

  it('defaults empty / ambiguous to Vietnamese', () => {
    assert.equal(detectCbetaAnswerLang(''), 'vi');
    assert.equal(detectCbetaAnswerLang('   '), 'vi');
  });

  it('prefers Vietnamese when VI mixes with English tokens', () => {
    assert.equal(detectCbetaAnswerLang('thiền là gì in English terms'), 'vi');
    assert.equal(detectCbetaAnswerLang('What is thiền?'), 'vi');
  });
});

describe('cbetaEmptyHitMessage', () => {
  it('matches answer language', () => {
    assert.match(cbetaEmptyHitMessage('thiền là'), /CBETA/);
    assert.match(cbetaEmptyHitMessage('禪是什麼'), /CBETA/);
    assert.match(cbetaEmptyHitMessage('what is chan'), /No matching/);
  });
});

describe('isCbetaCoverageIntent', () => {
  it('flags patriarch / list questions as coverage', () => {
    assert.equal(
      isCbetaCoverageIntent('Liệt kê các vị tổ trong truyền đăng lục'),
      true,
    );
    assert.equal(isCbetaCoverageIntent('danh sách các vị tổ sư'), true);
    assert.equal(
      isCbetaCoverageIntent('Kể tên các tổ sư Thiền theo truyền đăng'),
      true,
    );
    assert.equal(
      isCbetaCoverageIntent(
        'List the Chan patriarchs in the Transmission of the Lamp',
      ),
      true,
    );
  });

  it('does not treat brief essence of toàn bộ as coverage', () => {
    assert.equal(
      isCbetaCoverageIntent('yếu chỉ của toàn bộ kinh sách tóm gọn'),
      false,
    );
  });

  it('keeps ordinary questions on non-coverage', () => {
    assert.equal(isCbetaCoverageIntent('thiền là gì'), false);
  });

  it('does not false-positive 景德傳燈錄…馬祖 as coverage', () => {
    assert.equal(
      isCbetaCoverageIntent(
        'Trong 景德傳燈錄 (T51n2076), tìm mục: 懷讓禪師第二世下五十六人（馬祖法嗣）',
      ),
      false,
    );
  });

  it('does not treat fabrication probes as coverage', () => {
    assert.equal(
      isCbetaCoverageIntent(
        'Thiền sư 「完全虛構禪師甲乙丙」 có phải pháp tự của 馬祖道一 không?',
      ),
      false,
    );
  });
});

describe('isCbetaSectionListIntent (hallucination probes)', () => {
  it('rejects fabrication probes even if they contain 法嗣', () => {
    assert.equal(
      isCbetaSectionListIntent(
        'Thiền sư 「完全虛構禪師甲乙丙」 có phải pháp tự của 馬祖道一 trong T51n2076 không?',
      ),
      false,
    );
    assert.equal(
      isCbetaSectionListIntent(
        'Trong phạm vi CBETA đã index, có đoạn 「假造禪師虛雲二世法嗣完全虛構句」 không?',
      ),
      false,
    );
  });

  it('keeps Mazu-56 membership questions on section path', () => {
    assert.equal(
      isCbetaSectionListIntent('龐蘊 cư sĩ có trong danh sách 56 không?'),
      true,
    );
    assert.equal(
      isCbetaSectionListIntent('鄧隱峯 có trong danh sách không?'),
      true,
    );
  });

  it('detects Vietnamese Mazu-56 / 見錄 cues and rejects FakeMaster', () => {
    assert.equal(
      isCbetaSectionListIntent(
        '天目山明覺禪師 thuộc 見錄 hay 不錄 trong mục 56 pháp tự Mã Tổ?',
      ),
      true,
    );
    assert.equal(
      isCbetaSectionListIntent(
        'Có phải mọi pháp tự Mã Tổ đều có ngữ lục 見錄 không?',
      ),
      true,
    );
    assert.equal(
      isCbetaSectionListIntent(
        'Thiền sư FakeMaster999 có trong 馬祖法嗣 không?',
      ),
      false,
    );
  });
});

describe('isCbetaSchoolLineageIntent / coverage exclusion', () => {
  it('routes Tào Động succession off global coverage dump', () => {
    const q =
      'liệt kê các vị tổ theo dòng truyền thừa của tông tào động giúp tôi';
    assert.equal(isCbetaSchoolLineageIntent(q), true);
    assert.equal(isCbetaCoverageIntent(q), false);
  });

  it('keeps bare patriarch-list coverage on', () => {
    assert.equal(
      isCbetaCoverageIntent('Liệt kê các vị tổ trong truyền đăng lục'),
      true,
    );
  });
});

describe('isCbetaBriefQuestion', () => {
  it('detects VI / ZH / EN brief cues', () => {
    assert.equal(isCbetaBriefQuestion('tóm gọn yếu chỉ thiền'), true);
    assert.equal(isCbetaBriefQuestion('請簡要說明'), true);
    assert.equal(isCbetaBriefQuestion('summarize briefly'), true);
    assert.equal(isCbetaBriefQuestion('thiền là gì'), false);
  });
});
