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
  // Include "các vị tổ", "truyền đăng" (VI) — not only "tổ sư" / 傳燈.
  if (
    /tổ\s*sư|các\s*vị\s*tổ|những\s*vị\s*tổ|truyền\s*đăng|truyen\s*dang|祖師|二十八祖|西天|東土|傳燈|ngũ\s*gia|thất\s*tông|patriarchs?|transmission\s+of\s+the\s+lamp/i.test(
      q,
    )
  ) {
    return (
      coverageIntent(q) ||
      /tổ\s*sư|các\s*vị\s*tổ|những\s*vị\s*tổ|祖師|二十八|西天|東土|傳燈|truyền\s*đăng|patriarchs?|transmission\s+of\s+the\s+lamp/i.test(
        q,
      )
    );
  }
  return false;
}

/**
 * When the user names a specific lamp/chronicle (e.g. "truyền đăng lục"),
 * return a Postgres/JS title regex to narrow deep coverage — avoid scanning
 * every 傳燈|五燈|… work (can hang for minutes).
 */
export function coverageTitleHintRegex(question: string): string | null {
  const q = (question || '').normalize('NFC');
  if (!q.trim()) return null;
  // More specific first.
  if (/續\s*傳燈|tục\s*truyền\s*đăng|續傳燈錄/i.test(q)) {
    return '續傳燈';
  }
  // Bare "truyền đăng lục" / 傳燈錄 → Jingde (not every *傳燈* title).
  if (
    /景德\s*傳燈|jingde|cảnh\s*đức\s*truyền\s*đăng|truyền\s*đăng\s*lục|truyen\s*dang\s*luc|傳燈\s*錄|傳燈錄|transmission\s+of\s+the\s+lamp/i.test(
      q,
    )
  ) {
    return '景德傳燈';
  }
  if (/truyền\s*đăng|truyen\s*dang|chuandeng/i.test(q)) {
    return '傳燈';
  }
  if (/ngũ\s*đăng|ngu\s*dang|五燈\s*會元|五燈會元|五燈/i.test(q)) {
    return '五燈';
  }
  if (/chỉ\s*nguyệt|chi\s*nguyet|指月/i.test(q)) {
    return '指月';
  }
  if (/tổ\s*thống|宗統/i.test(q)) {
    return '宗統';
  }
  if (/phật\s*tổ\s*thống|佛祖統/i.test(q)) {
    return '佛祖統';
  }
  if (/cao\s*tăng\s*truyện|高僧傳/i.test(q)) {
    return '高僧傳';
  }
  return null;
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
