import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCbetaCoverageListAnswer } from './cbeta-coverage-answer.util';

describe('formatCbetaCoverageListAnswer', () => {
  const entities = [
    { nameZh: '迦葉', count: 9, works: ['T51n2076'] },
    { nameZh: '阿難', count: 7, works: ['T51n2076'] },
    { nameZh: '商那和修', count: 3, works: ['T51n2076'] },
  ];

  it('answers Vietnamese for VI list questions', () => {
    const text = formatCbetaCoverageListAnswer(
      'Liệt kê các vị tổ trong truyền đăng lục',
      entities,
      ['T51n2076'],
      50_000,
    );
    assert.match(text, /Các tên xuất hiện/);
    assert.match(text, /1\. 迦葉/);
    assert.match(text, /【AI diễn giải】/);
    assert.doesNotMatch(text, /I'm |I need |entity list/i);
  });

  it('answers Chinese for ZH questions', () => {
    const text = formatCbetaCoverageListAnswer(
      '列出傳燈錄祖師',
      entities,
      ['T51n2076'],
      50_000,
    );
    assert.match(text, /以下為已掃/);
    assert.match(text, /1\. 迦葉/);
  });

  it('answers English for EN questions', () => {
    const text = formatCbetaCoverageListAnswer(
      'What are the Chan patriarchs in Jingde Chuandenglu?',
      entities,
      ['T51n2076'],
      50_000,
    );
    assert.match(text, /Names attested/);
    assert.match(text, /1\. 迦葉/);
  });

  it('respects maxChars budget without inventing a fixed row cap', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      nameZh: `名${i}`,
      count: 200 - i,
      works: ['T51n2076'],
    }));
    const text = formatCbetaCoverageListAnswer(
      'liệt kê tổ',
      many,
      ['T51n2076'],
      80,
    );
    assert.match(text, /còn \d+ tên/);
    assert.ok(text.length < 400);
  });
});
