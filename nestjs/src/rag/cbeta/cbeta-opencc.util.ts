/**
 * Force Simplified → Traditional (OpenCC) before CBETA lexical / embed query.
 * CBETA text is classical Traditional; LLM rewrite often emits Simplified.
 */
import * as OpenCC from 'opencc-js';

let converter: ((s: string) => string) | null = null;

function getConverter(): (s: string) => string {
  if (!converter) {
    converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
  }
  return converter;
}

/** Convert string to Traditional Chinese (no-op on empty). */
export function toTraditionalZh(text: string): string {
  const t = (text || '').trim();
  if (!t) return '';
  try {
    return getConverter()(t);
  } catch {
    return t;
  }
}

export function toTraditionalZhList(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const t = toTraditionalZh(item);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
