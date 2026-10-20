/** Names that are almost always false positives in lamp/biographical prose. */
export const NAME_STOP = new Set([
  '諸佛',
  '一切',
  '比丘',
  '菩薩',
  '如來',
  '世尊',
  '某甲',
  '座主',
  '長老',
  '上座',
  '禪和',
  '師僧',
  '諸祖',
  '古今',
  '天下',
  '山中',
  '室中',
  '方丈',
  '當代',
  '近代',
  '前代',
  '後代',
  '歷代',
  '本朝',
  '大唐',
  '大宋',
  '皇朝',
]);

const MASTER_RE = /([\u4e00-\u9fff]{2,8})(?:禪師|和尚|大師)/g;

/**
 * Extract Chan master-style names from Hán văn (禪師 / 和尚 / 大師).
 * Used by deep coverage multi-pass + entity table upsert.
 */
export function extractMasterNames(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  const seen = new Set<string>();
  MASTER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MASTER_RE.exec(text)) !== null) {
    let name = (m[1] || '').trim();
    // Strip narrative prefixes glued into the capture (時有玄奘禪師 → 玄奘).
    name = name.replace(/^(時有|乃有|復有|又有|即有|遂有|有)/, '');
    if (name.length > 4) name = name.slice(-4);
    if (!isPlausibleMasterName(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    found.push(name);
  }
  return found;
}

/** Plausible master / patriarch name for coverage lists. */
export function isPlausibleMasterName(name: string): boolean {
  const n = (name || '').trim();
  if (!n) return false;
  if (NAME_STOP.has(n)) return false;
  if (!/^[\u4e00-\u9fff]{2,8}$/.test(n)) return false;
  if (/^[一二三四五六七八九十百千]+$/.test(n)) return false;
  return true;
}

export type CoverageEntity = {
  nameZh: string;
  count: number;
  works: string[];
};

/**
 * Drop stop-name noise; keep highest-count plausible names.
 * Does not invent a fixed row cap — callers apply char budgets.
 */
export function filterCoverageEntities(
  entities: CoverageEntity[],
): CoverageEntity[] {
  return [...entities]
    .filter((e) => isPlausibleMasterName(e.nameZh))
    .sort(
      (a, b) =>
        b.count - a.count || a.nameZh.localeCompare(b.nameZh, 'zh'),
    );
}

/** Overlap score between query and passage (CJK chars / bigrams). */
export function lexicalOverlapScore(query: string, passage: string): number {
  const q = [...query.replace(/\s+/g, '')];
  if (!q.length || !passage) return 0;
  const p = passage;
  let hit = 0;
  const uni = new Set(q.filter((ch) => /[\u4e00-\u9fff]/.test(ch)));
  for (const ch of uni) {
    if (p.includes(ch)) hit += 1;
  }
  let bi = 0;
  let biHit = 0;
  for (let i = 0; i < q.length - 1; i++) {
    const a = q[i];
    const b = q[i + 1];
    if (!/[\u4e00-\u9fff]/.test(a) || !/[\u4e00-\u9fff]/.test(b)) continue;
    bi += 1;
    if (p.includes(a + b)) biHit += 1;
  }
  const uniScore = uni.size ? hit / uni.size : 0;
  const biScore = bi ? biHit / bi : 0;
  return uniScore * 0.45 + biScore * 0.55;
}
