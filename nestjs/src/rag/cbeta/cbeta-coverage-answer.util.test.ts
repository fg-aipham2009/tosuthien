import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertCbetaAnswerLang } from './cbeta-answer-quality.util';
import { formatCbetaCoverageListAnswer } from './cbeta-coverage-answer.util';

describe('formatCbetaCoverageListAnswer', () => {
  const entities = [
    { nameZh: '諸佛', count: 99, works: ['T51n2076'] },
    { nameZh: '比丘', count: 80, works: ['T51n2076'] },
    { nameZh: '迦葉', count: 9, works: ['T51n2076'] },
    { nameZh: '阿難', count: 7, works: ['T51n2076'] },
    { nameZh: '商那和修', count: 3, works: ['T51n2076'] },
    { nameZh: '慧可', count: 4, works: ['T51n2076'] },
    { nameZh: '慧能', count: 6, works: ['T51n2076'] },
    { nameZh: '菩提達磨', count: 8, works: ['T51n2076'] },
  ];

  it('answers Vietnamese and drops stop-name noise', () => {
    const text = formatCbetaCoverageListAnswer(
      'Liệt kê các vị tổ trong truyền đăng lục',
      entities,
      ['T51n2076'],
      50_000,
    );
    assert.match(text, /Tây Thiên|西天/);
    assert.match(text, /Đông Độ|東土/);
    assert.doesNotMatch(text, /諸佛/);
    assert.doesNotMatch(text, /比丘/);
    assert.match(text, /迦葉/);
    assert.match(text, /慧能/);
    assert.match(text, /【AI diễn giải】/);
    const gate = assertCbetaAnswerLang(text, 'vi');
    assert.equal(gate.ok, true, gate.reason);
  });

  it('answers Chinese for ZH questions with lineage sections when names present', () => {
    const text = formatCbetaCoverageListAnswer(
      '列出傳燈錄祖師',
      entities,
      ['T51n2076'],
      50_000,
    );
    assert.match(text, /西天/);
    assert.match(text, /東土/);
    assert.doesNotMatch(text, /諸佛/);
  });

  it('answers English for EN questions', () => {
    const text = formatCbetaCoverageListAnswer(
      'What are the Chan patriarchs in Jingde Chuandenglu?',
      entities,
      ['T51n2076'],
      50_000,
    );
    assert.match(text, /West|India|Western|East|China|lineage|Patriarch/i);
    assert.doesNotMatch(text, /諸佛/);
    const gate = assertCbetaAnswerLang(text, 'en');
    assert.equal(gate.ok, true, gate.reason);
  });

  it('respects maxChars budget without inventing a fixed row cap', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      nameZh: `名${String.fromCharCode(0x4e00 + i)}${String.fromCharCode(0x4e01 + (i % 10))}`,
      count: 200 - i,
      works: ['T51n2076'],
    }));
    const text = formatCbetaCoverageListAnswer(
      'liệt kê tổ',
      many,
      ['T51n2076'],
      120,
    );
    assert.match(text, /còn \d+ tên|phụ lục/i);
    assert.ok(text.length < 800);
  });

  it('does not invent lineage names absent from entities', () => {
    const text = formatCbetaCoverageListAnswer(
      'Liệt kê các vị tổ trong truyền đăng lục',
      [{ nameZh: '趙州', count: 3, works: ['T51n2076'] }],
      ['T51n2076'],
      50_000,
    );
    assert.doesNotMatch(text, /迦葉/);
    assert.doesNotMatch(text, /慧能/);
    assert.match(text, /趙州/);
  });

  it('dedupes 摩訶迦葉 / 迦葉 and keeps appendix for non-lineage names', () => {
    const text = formatCbetaCoverageListAnswer(
      'Liệt kê các vị tổ trong truyền đăng lục',
      [
        { nameZh: '摩訶迦葉', count: 5, works: ['T51n2076'] },
        { nameZh: '迦葉', count: 9, works: ['T51n2076'] },
        { nameZh: '趙州', count: 4, works: ['T51n2076'] },
        { nameZh: '諸佛', count: 99, works: ['T51n2076'] },
      ],
      ['T51n2076'],
      50_000,
    );
    assert.match(text, /Tây Thiên/);
    assert.match(text, /Phụ lục/);
    assert.match(text, /趙州/);
    assert.doesNotMatch(text, /諸佛/);
    // Both aliases may appear only once each in order; 摩訶迦葉 before 迦葉 if both present.
    const xitianBlock = text.slice(
      text.indexOf('A. Tây Thiên'),
      text.indexOf('C. Phụ lục'),
    );
    assert.match(xitianBlock, /摩訶迦葉/);
    assert.match(xitianBlock, /迦葉/);
  });
});
