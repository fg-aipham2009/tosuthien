import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirror of AiConfigService.hhtechApiKeys parsing (unit, no Nest DI). */
function parseHhtechKeys(multi: string, single: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of `${multi}\n${single}`.split(/[\n,|;]+/)) {
    const k = raw.trim();
    if (!k.startsWith('sk-') || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

describe('HHTECH_API_KEYS parsing', () => {
  it('keeps order and dedupes', () => {
    const keys = parseHhtechKeys(
      'sk-aaa111,sk-bbb222\nsk-aaa111',
      'sk-ccc333',
    );
    assert.deepEqual(keys, ['sk-aaa111', 'sk-bbb222', 'sk-ccc333']);
  });

  it('accepts pipe / semicolon separators', () => {
    const keys = parseHhtechKeys('sk-one|sk-two;sk-three', '');
    assert.deepEqual(keys, ['sk-one', 'sk-two', 'sk-three']);
  });

  it('round-robin rotates hhtech first', () => {
    const hh = [
      { provider: 'hhtech', apiKey: 'sk-a' },
      { provider: 'hhtech', apiKey: 'sk-b' },
      { provider: 'hhtech', apiKey: 'sk-c' },
    ];
    const rotate = (list: typeof hh, start: number) => [
      ...list.slice(start),
      ...list.slice(0, start),
    ];
    assert.deepEqual(
      rotate(hh, 0).map((e) => e.apiKey),
      ['sk-a', 'sk-b', 'sk-c'],
    );
    assert.deepEqual(
      rotate(hh, 1).map((e) => e.apiKey),
      ['sk-b', 'sk-c', 'sk-a'],
    );
    assert.deepEqual(
      rotate(hh, 2).map((e) => e.apiKey),
      ['sk-c', 'sk-a', 'sk-b'],
    );
  });
});
