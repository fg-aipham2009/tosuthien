/**
 * Pre-retrieve enrichment for CBETA: expand list/coverage queries and
 * diversify packed hits so the answer LLM sees less duplicate noise.
 */

import { isCbetaCoverageIntent as coverageIntent } from './cbeta-intent.util';

export { isCbetaCoverageIntent } from './cbeta-intent.util';

/** Default lamp/chronicle title regex when env CBETA_COVERAGE_TITLE_REGEX is unset. */
export const DEFAULT_CBETA_COVERAGE_TITLE_REGEX =
  '傳燈|五燈|指月|高僧傳|續燈|會元|燈錄|禪林|宗統|佛祖統|佛祖歷代|正宗記|傳法正宗';

/**
 * Extra Hán search phrases for patriarch / lineage list questions.
 * Appended to rewrite output — not invented work_codes.
 */
const PATRIARCH_LIST_TERMS = [
  '西天二十八祖',
  '東土六祖',
  '歷代祖師',
  '傳法世系',
  '景德傳燈錄',
  '五燈會元',
  '指月錄',
  '宗統編年',
  '佛祖統紀',
  '傳法正宗記',
];

export function isPatriarchListIntent(question: string): boolean {
  const q = (question || '').trim();
  if (!q) return false;
  if (/tổ\s*sư|祖師|二十八祖|西天|東土|傳燈|ngũ\s*gia|thất\s*tông/i.test(q)) {
    return coverageIntent(q) || /tổ\s*sư|祖師|二十八|西天|東土/i.test(q);
  }
  return false;
}

/**
 * Merge rewrite search with deterministic coverage/patriarch terms.
 */
export function enrichCbetaSearchZh(
  question: string,
  searchZh: string,
  keywords: string[] = [],
): { searchZh: string; keywords: string[] } {
  const base = (searchZh || question || '').trim();
  const kw = [...keywords];
  if (!isPatriarchListIntent(question) && !coverageIntent(question)) {
    return { searchZh: base, keywords: kw };
  }

  const extra =
    isPatriarchListIntent(question) || /tổ|祖/i.test(question)
      ? PATRIARCH_LIST_TERMS
      : ['傳燈', '五燈會元', '燈錄', '祖師'];

  const parts = [base, ...extra];
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const p of parts) {
    const t = (p || '').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    merged.push(t);
  }
  for (const t of extra) {
    if (!kw.includes(t)) kw.push(t);
  }
  return { searchZh: merged.join(' '), keywords: kw };
}

function contentFingerprint(text: string): string {
  return (text || '')
    .replace(/\s+/g, '')
    .slice(0, 96);
}

/**
 * Prefer diverse works, drop near-duplicate bodies, keep score order within work.
 * Does not invent a fixed max count — uses all hits until budget/caller slices.
 */
export function diversifyCbetaHits<
  T extends { workCode: string; contentZh: string; score: number },
>(hits: T[]): T[] {
  if (hits.length <= 1) return hits;
  const byWork = new Map<string, T[]>();
  const order: string[] = [];
  for (const h of [...hits].sort((a, b) => b.score - a.score)) {
    const w = h.workCode || '?';
    if (!byWork.has(w)) {
      byWork.set(w, []);
      order.push(w);
    }
    byWork.get(w)!.push(h);
  }

  const out: T[] = [];
  const fps = new Set<string>();
  let progress = true;
  while (progress) {
    progress = false;
    for (const w of order) {
      const list = byWork.get(w);
      if (!list?.length) continue;
      const next = list.shift()!;
      const fp = contentFingerprint(next.contentZh);
      if (fp && fps.has(fp)) continue;
      if (fp) fps.add(fp);
      out.push(next);
      progress = true;
    }
  }
  return out;
}
