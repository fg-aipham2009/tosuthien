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
  // Dialogue / stock phrases wrongly captured before 禪師|和尚|大師
  '問如何是',
  '如何是',
  '未審',
  '曰請',
  '便請',
  '只如',
  '山頭',
  '不敢孤負',
  '曰未審',
  '云何',
  '作麼生',
  '什麼',
  '什麼物',
  '阿誰',
  '誰人',
  '今請',
  '人問',
  '莫便是',
  '豈不是',
  '不勞',
  '和尚',
  '禪師',
  '大師',
]);

/** Leading narrative / dialog glue before a real personal name. */
const NAME_PREFIX_RE =
  /^(時有|乃有|復有|又有|即有|遂有|有|問|曰|云|便|請|乃|即|遂|勅諡|詔諡|諡|號|署)/;

/**
 * Substrings that mark non-name dialogue / stock prose / narrative glue.
 * Applied after capture so appendix does not dump 問答碎片.
 */
const NAME_NOISE_RE =
  /如何是|未審|孤負|作麼|什麼|云何|曰請|便請|只如|問如何|某甲|恁麼|怎麼|禮拜|舉似|呈似|祇對|秖對|道不得|不惱亂|特來|暫來|昨日|今日|聞說|却請|却是|也請|也是|還識|還見|豈不|莫是|莫便|人問|今請|不勞|不妨|不敢|不須|不會|不識|不見|僧問|僧云|師曰|師云|師問|弟子|伏惟|蒙示|蒙恩|請問|咨|請命|請米|請取|見是|非請|時願|來辭|百非|首見|舉首|絕百|辭時|却勞|更請|更謝/;

/** Truncated place / office heads from over-long captures (撫州… → 州…). */
const TRUNCATED_GEO_HEAD_RE = /^[州府縣邑郡]/;

/** Title / epithet left in as if it were the personal name. */
const TITLE_HEAD_RE = /^(禪師|和尚|大師|禪和|師僧|座主|長老)/;

/** Honorific / imperial epithet fragments. */
const EPITHET_RE = /^[勅詔賜追重]?[諡謚]|^號|^署|^勅|^詔/;

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
    const normalized = normalizeExtractedName((m[1] || '').trim());
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    found.push(normalized);
  }
  return found;
}

/**
 * Attest literal known names (e.g. 西天二十八祖) when they appear in prose
 * without a 禪師|和尚|大師 suffix.
 */
export function extractLiteralNameMentions(
  text: string,
  known: readonly string[],
): string[] {
  if (!text || !known.length) return [];
  const found: string[] = [];
  const seen = new Set<string>();
  // Longer forms first so 摩訶迦葉 wins over 迦葉 when both match the same span.
  const ordered = [...known].sort((a, b) => b.length - a.length);
  for (const name of ordered) {
    if (!name || name.length < 2 || seen.has(name)) continue;
    if (!text.includes(name)) continue;
    seen.add(name);
    found.push(name);
  }
  return found;
}

function normalizeExtractedName(raw: string): string | null {
  let name = raw.replace(NAME_PREFIX_RE, '');
  if (name.length > 4) {
    // Prefer a 2–4 char personal / mountain+dharma tail that is not truncated geo.
    const candidates = [name.slice(-4), name.slice(-3), name.slice(-2)];
    let picked: string | null = null;
    for (const c of candidates) {
      if (TRUNCATED_GEO_HEAD_RE.test(c)) continue;
      if (isPlausibleMasterName(c)) {
        picked = c;
        break;
      }
    }
    if (!picked) return null;
    name = picked;
  }
  if (name.length >= 3 && NAME_NOISE_RE.test(name)) {
    const tail = name.slice(-2);
    if (isPlausibleMasterName(tail)) name = tail;
  }
  if (!isPlausibleMasterName(name)) return null;
  return name;
}

/** Plausible master / patriarch name for coverage lists. */
export function isPlausibleMasterName(name: string): boolean {
  const n = (name || '').trim();
  if (!n) return false;
  if (NAME_STOP.has(n)) return false;
  if (!/^[\u4e00-\u9fff]{2,8}$/.test(n)) return false;
  if (/^[一二三四五六七八九十百千]+$/.test(n)) return false;
  // Ordinal + temple glue: 一祖道信 / 二世智巖 / bare 祖道信 — keep only if stripped elsewhere.
  if (/^[一二三四五六七八九十]+[祖世]/.test(n)) return false;
  if (/^[祖世]/.test(n)) return false;
  if (/第[一二三四五六七八九十百]+/.test(n)) return false;
  if (NAME_NOISE_RE.test(n)) return false;
  if (TRUNCATED_GEO_HEAD_RE.test(n)) return false;
  if (TITLE_HEAD_RE.test(n)) return false;
  if (EPITHET_RE.test(n)) return false;
  // Pure function / interrogative starts.
  if (/^[問曰云何作莫豈不人今却更也又若來去見謁參後時]/.test(n) && n.length <= 3) {
    return false;
  }
  // Dialogue-like openers (short only — do not reject 不如密多 etc.).
  if (n.length <= 3 && /^[問曰云莫豈却]/.test(n)) return false;
  if (n.length <= 3 && /^不[道識見會須妨敢勞如異曲]/.test(n)) return false;
  // Narrative verb / visit glue left as a "name".
  if (n.length <= 4 && /^[見謁參禮聞遇屬]/.test(n)) return false;
  // Dialogue tails / particles that almost never end a real dharma name.
  if (/[是請麼著]$/.test(n)) return false;
  if (/請/.test(n)) return false;
  // Truncated "X院Y" / bare "Y山" office heads without a clear 2-char dharma tail
  // are common false positives after {2,8} capture; keep mountain+name of len 3–4
  // only when the last 2 chars look like a personal name (not geo particle).
  if (/^[院寺峰峯嶺洞潭]$/.test(n.slice(0, 1)) && n.length <= 3) return false;
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
  opts?: { minCount?: number },
): CoverageEntity[] {
  const minCount =
    typeof opts?.minCount === 'number' && opts.minCount > 0
      ? opts.minCount
      : 1;
  return [...entities]
    .filter(
      (e) => e.count >= minCount && isPlausibleMasterName(e.nameZh),
    )
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
