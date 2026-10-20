import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cbetaEmptyHitMessage,
  detectCbetaAnswerLang,
  isCbetaBriefQuestion,
  isCbetaCoverageIntent,
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
});

describe('isCbetaBriefQuestion', () => {
  it('detects VI / ZH / EN brief cues', () => {
    assert.equal(isCbetaBriefQuestion('tóm gọn yếu chỉ thiền'), true);
    assert.equal(isCbetaBriefQuestion('請簡要說明'), true);
    assert.equal(isCbetaBriefQuestion('summarize briefly'), true);
    assert.equal(isCbetaBriefQuestion('thiền là gì'), false);
  });
});
