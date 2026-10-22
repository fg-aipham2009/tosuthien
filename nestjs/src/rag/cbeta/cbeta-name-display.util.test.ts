import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatMasterDisplayName,
  hasMasterDisplayName,
  sinoVietReading,
} from './cbeta-name-display.util';

describe('formatMasterDisplayName', () => {
  it('uses curated Sino-Viet for known patriarchs', () => {
    assert.equal(
      formatMasterDisplayName('慧能', 'vi'),
      'Huệ Năng (慧能)',
    );
  });

  it('falls back to char-level Hán-Việt so VI lists are not bare Hán', () => {
    const line = formatMasterDisplayName('藥山惟儼', 'vi');
    assert.match(line, /\(藥山惟儼\)/);
    assert.doesNotMatch(line, /^藥山惟儼$/);
    assert.ok(/[A-Za-zÀ-ỹ]/.test(line));
  });

  it('keeps ZH as Hán only', () => {
    assert.equal(formatMasterDisplayName('藥山惟儼', 'zh'), '藥山惟儼');
  });

  it('EN uses curated gloss or Latin fallback (not bare Hán alone)', () => {
    assert.equal(
      formatMasterDisplayName('慧能', 'en'),
      'Huineng (慧能)',
    );
    const line = formatMasterDisplayName('藥山惟儼', 'en');
    assert.match(line, /\(藥山惟儼\)/);
    assert.ok(/Yaoshan|Duoc Son|Dược/i.test(line) || /[A-Za-z]{3,}/.test(line));
    assert.ok(hasMasterDisplayName('藥山惟儼', 'en'));
  });
});

describe('sinoVietReading / hasMasterDisplayName', () => {
  it('reads common lamp characters', () => {
    assert.equal(sinoVietReading('行思'), 'Hành Tư');
    assert.ok(hasMasterDisplayName('藥山惟儼', 'vi'));
  });

  it('returns null when any character is unknown', () => {
    assert.equal(sinoVietReading('𠀀行'), null);
  });
});
