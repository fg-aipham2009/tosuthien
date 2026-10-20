import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractPreservedCjk,
  parseCbetaCitationHints,
} from './cbeta-query-parse.util';

describe('parseCbetaCitationHints', () => {
  it('parses T51n2076 work codes', () => {
    const h = parseCbetaCitationHints('xem T51n2076 và giải thích');
    assert.ok(h.workCodes.includes('T51n2076'));
  });

  it('parses juan / quyển', () => {
    assert.equal(parseCbetaCitationHints('卷3 nội dung').juanNo, 3);
    assert.equal(parseCbetaCitationHints('quyển 12').juanNo, 12);
  });

  it('parses linehead and page needles', () => {
    assert.equal(
      parseCbetaCitationHints('p0292c16').cbetaRefNeedle,
      'p0292c16',
    );
    assert.equal(
      parseCbetaCitationHints('trang 292').cbetaRefNeedle,
      'p0292',
    );
  });
});

describe('extractPreservedCjk', () => {
  it('keeps CJK runs from mixed VI questions', () => {
    const runs = extractPreservedCjk('trong 景德傳燈錄 hỏi về 祖師');
    assert.ok(runs.includes('景德傳燈錄'));
    assert.ok(runs.includes('祖師'));
  });
});
