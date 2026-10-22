/**
 * Chan school (五家) succession queries — routing/retrieval helpers.
 * Search anchors only; never emit a hard-coded answer tree.
 */

export type CbetaSchoolKey =
  | 'caodong'
  | 'linji'
  | 'yunmen'
  | 'weiyang'
  | 'fayan';

export interface CbetaSchoolSpec {
  key: CbetaSchoolKey;
  /** Canonical Hán label used in CBETA (宗 name). */
  nameZh: string;
  /** VI / Hán aliases that identify this school in the question. */
  aliases: RegExp;
  /**
   * Lexical needles for hybrid/FTS — school name + succession markers.
   * Not an answer list of masters.
   */
  searchNeedles: string[];
}

/** Five houses (五家). 七宗 variants still resolve to these cores when named. */
export const CBETA_SCHOOL_SPECS: CbetaSchoolSpec[] = [
  {
    key: 'caodong',
    nameZh: '曹洞',
    aliases:
      /曹洞|tào\s*động|tao\s*dong|caodong|soto/i,
    searchNeedles: [
      '曹洞宗',
      '曹洞',
      '洞山',
      '曹山',
      '雲居',
      '法嗣',
      '師承',
      '宗派圖',
      '正傳',
      '洞宗',
    ],
  },
  {
    key: 'linji',
    nameZh: '臨濟',
    aliases: /臨濟|lâm\s*tế|lam\s*te|linji|rinzai/i,
    searchNeedles: [
      '臨濟宗',
      '臨濟',
      '黃檗',
      '百丈',
      '法嗣',
      '師承',
      '宗派圖',
      '正傳',
    ],
  },
  {
    key: 'yunmen',
    nameZh: '雲門',
    aliases: /雲門|vân\s*môn|van\s*mon|yunmen/i,
    searchNeedles: [
      '雲門宗',
      '雲門',
      '文偃',
      '法嗣',
      '師承',
      '宗派圖',
      '正傳',
    ],
  },
  {
    key: 'weiyang',
    nameZh: '溈仰',
    aliases: /溈仰|潙仰|溈山|潙山|quy\s*ngưỡng|qui\s*nguong|guiyang|weiyang/i,
    searchNeedles: [
      '溈仰宗',
      '潙仰宗',
      '溈仰',
      '溈山',
      '仰山',
      '法嗣',
      '師承',
      '宗派圖',
      '正傳',
    ],
  },
  {
    key: 'fayan',
    nameZh: '法眼',
    aliases: /法眼|pháp\s*nhãn|phap\s*nhan|fayan/i,
    searchNeedles: [
      '法眼宗',
      '法眼',
      '清涼文益',
      '文益',
      '法嗣',
      '師承',
      '宗派圖',
      '正傳',
    ],
  },
];

const LINEAGE_ASK_RE =
  /liệt\s*kê|kể\s*tên|danh\s*sách|truyền\s*thừa|dòng|pháp\s*tự|tông|宗|五家|ngũ\s*gia|thất\s*tông|lineage|師承|法嗣|enumerate|list/i;

/**
 * Detect a named-school succession question (vs global patriarch coverage).
 */
export function detectCbetaSchoolLineage(
  question: string,
): CbetaSchoolSpec | null {
  const q = (question || '').trim();
  if (!q) return null;
  if (!LINEAGE_ASK_RE.test(q) && !/宗派|正傳|世系/u.test(q)) {
    // Still allow bare "pháp hệ Tào Động" style without liệt kê
    if (!/pháp\s*hệ|phả\s*hệ|truyền\s*thừa|dòng\s*truyền/i.test(q)) {
      return null;
    }
  }
  for (const spec of CBETA_SCHOOL_SPECS) {
    if (spec.aliases.test(q)) return spec;
  }
  return null;
}

export function isCbetaSchoolLineageQuestion(question: string): boolean {
  return detectCbetaSchoolLineage(question) != null;
}

/** Merge school succession needles into searchZh / keywords. */
export function enrichSchoolLineageSearch(
  question: string,
  searchZh: string,
  keywords: string[] = [],
): { searchZh: string; keywords: string[] } | null {
  const spec = detectCbetaSchoolLineage(question);
  if (!spec) return null;
  const base = (searchZh || question || '').trim();
  const kw = [...keywords];
  const extras = [...spec.searchNeedles];
  const parts = [base, ...extras];
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const p of parts) {
    const t = (p || '').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    merged.push(t);
  }
  for (const t of extras) {
    if (!kw.includes(t)) kw.push(t);
  }
  return { searchZh: merged.join(' '), keywords: kw };
}

/**
 * Soft rank boost for chunks that look like succession evidence for a school.
 * Purely heuristic on retrieved text — does not invent edges.
 */
export function schoolLineageChunkBoost(
  contentZh: string,
  titleZh: string,
  schoolNameZh: string,
): number {
  const t = `${titleZh || ''}\n${contentZh || ''}`;
  if (!t) return 0;
  let s = 0;
  if (t.includes(schoolNameZh)) s += 25;
  if (t.includes(`${schoolNameZh}宗`)) s += 15;
  if (/法嗣|師嗣|嗣法|親承|得法/u.test(t)) s += 20;
  if (/宗派圖|正傳|世系|燈譜|禪燈世譜/u.test(t)) s += 30;
  if (/下第[一二三四五六七八九十百]+世|第[一二三四五六七八九十]+世/u.test(t)) {
    s += 15;
  }
  // Dense succession prose (many 嗣 markers)
  const siu = (t.match(/嗣/g) || []).length;
  s += Math.min(25, siu * 3);
  return s;
}

/** Intent-brief block for the LLM (evidence-first, no fabrication). */
export function schoolLineageIntentBrief(spec: CbetaSchoolSpec): string {
  return [
    `SCHOOL_LINEAGE: school=${spec.nameZh}宗 (${spec.key}).`,
    `PHẦN 1 MUST present this school’s teacher→disciple tree in order (main trunk + major branches when CBETA attests them).`,
    `For 曹洞: when sources support it, show both 曹山 and 雲居 branches under 洞山 and later generations — only from context.`,
    `Each edge MUST quote or paraphrase CBETA succession evidence (嗣X / 法嗣 / 下第N世 / 宗派圖) and name work_code + juan or cbeta_ref when present in context.`,
    `FORBIDDEN: inventing 法嗣 links; 西天/東土 28-patriarch dump; frequency appendix of unrelated masters; mixing other 五家 schools as this school’s line.`,
    `If a link is not in the retrieved blocks, say so — do not fill gaps from general knowledge.`,
  ].join(' ');
}
