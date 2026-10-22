/**
 * Section-scoped lamp register lists (e.g. 馬祖法嗣 五十六人).
 * Parse ordered master names from CBETA prose — no hard-coded GT lists.
 */

import { detectCbetaAnswerLang, type CbetaAnswerLang } from './cbeta-intent.util';

/**
 * Dense register: Place+Name+Title concatenated without separators.
 * Include Ext-A (U+3400+) so rare forms like 黑㵎 match.
 */
const CJK = String.raw`[\u3400-\u9fff\uf900-\ufaff]`;
const SECTION_NAME_RE = new RegExp(
  `((?:${CJK}+?)(?:禪師|和尚|大師|坐主)|(?:${CJK}+?)居士(?:${CJK}+))`,
  'gu',
);

const RECORDED_MARK_RE = /已上[一二三四五六七八九十百零〇\d]+人見錄/;
const NOREC_MARK_RE = /已上[一二三四五六七八九十百零〇\d]+人無機緣語句不錄|無機緣語句不錄/;

/**
 * Longest CJK run in the question usable as a heading / section needle.
 * Prefer explicit parenthetical headings when present.
 */
export function extractSectionHeadingNeedle(question: string): string | null {
  const q = (question || '').normalize('NFC').trim();
  if (!q) return null;
  // Prefer the full 懷讓…五十六人（馬祖法嗣） span when present.
  const full =
    q.match(
      /懷讓禪師第二世下五十六人（馬祖法嗣）|第二世下五十六人（馬祖法嗣）|懷讓禪師第二世下五十六人|五十六人（馬祖法嗣）|馬祖法嗣/u,
    )?.[0] || null;
  if (full && full.length >= 4) return full;
  const runs = q.match(/[\u4e00-\u9fff（）()]{4,40}/gu) || [];
  if (!runs.length) return null;
  return runs.sort((a, b) => b.length - a.length)[0] || null;
}

export interface ParsedSectionList {
  heading: string | null;
  recorded: string[];
  norecorded: string[];
  allNames: string[];
}

/**
 * Parse ordered names from a lamp register section (document order).
 */
export function parseOrderedMastersFromSection(
  contentZh: string,
  headingHint?: string | null,
): ParsedSectionList {
  const text = (contentZh || '').normalize('NFC');
  let heading: string | null = null;
  if (headingHint && text.includes(headingHint.replace(/[（）]/g, (c) => c))) {
    heading = headingHint;
  } else {
    const hm = text.match(
      /[\u4e00-\u9fff]{2,20}第二世下五十六人（馬祖法嗣）|第二世下五十六人（馬祖法嗣）|[\u4e00-\u9fff]{2,30}法嗣/u,
    );
    heading = hm?.[0] || headingHint || null;
  }

  const recIdx = text.search(RECORDED_MARK_RE);
  const norecIdx = text.search(NOREC_MARK_RE);

  let recordedPart = text;
  let norecPart = '';
  if (recIdx >= 0) {
    recordedPart = text.slice(0, recIdx);
    if (norecIdx > recIdx) {
      norecPart = text.slice(recIdx, norecIdx);
    } else {
      norecPart = text.slice(recIdx);
    }
  }

  const recorded = extractNamesInOrder(recordedPart);
  const norecorded = extractNamesInOrder(norecPart).filter(
    (n) => !recorded.includes(n),
  );
  // If markers missing, treat whole text as one ordered list.
  const allNames =
    recorded.length || norecorded.length
      ? [...recorded, ...norecorded]
      : extractNamesInOrder(text);

  return { heading, recorded, norecorded, allNames };
}

function extractNamesInOrder(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  SECTION_NAME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SECTION_NAME_RE.exec(text)) !== null) {
    const name = (m[1] || '').trim();
    if (!name || name.length < 3) continue;
    // Skip section labels mistaken as names
    if (/五十六人|第二世|見錄|不錄|無機緣/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export interface SectionListFormatInput {
  question: string;
  titleZh: string;
  workCode: string;
  juanNo: number | null;
  cbetaRefStart: string | null;
  parsed: ParsedSectionList;
  charBudget?: number;
}

/** Deterministic PHẦN 1 for section-scoped register questions. */
export function formatCbetaSectionListAnswer(
  input: SectionListFormatInput,
): string {
  const lang = detectCbetaAnswerLang(input.question);
  const budget = input.charBudget && input.charBudget > 0 ? input.charBudget : 80_000;
  const heading =
    input.parsed.heading ||
    extractSectionHeadingNeedle(input.question) ||
    '（mục đã định vị）';
  const ref = input.cbetaRefStart
    ? `p.${input.cbetaRefStart.replace(/^p/i, '')}`
    : null;
  const juan =
    input.juanNo != null && input.juanNo > 0 ? `quyển ${input.juanNo}` : null;
  const loc = [input.titleZh, input.workCode, juan, ref]
    .filter(Boolean)
    .join(' · ');

  const rec = input.parsed.recorded;
  const norec = input.parsed.norecorded;
  const all = input.parsed.allNames;

  const lines: string[] = [];
  if (lang === 'zh') {
    lines.push(`# 定位`);
    lines.push(`- 作品：${input.titleZh}（${input.workCode}）`);
    if (juan) lines.push(`- 卷：${juan}`);
    if (ref) lines.push(`- 出處：${ref}`);
    lines.push(`- 目次：${heading}`);
    lines.push('');
    if (rec.length || norec.length) {
      lines.push(`## 見錄（${rec.length}）`);
      rec.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
      lines.push('');
      lines.push(`## 無機緣語句不錄（${norec.length}）`);
      norec.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
    } else {
      lines.push(`## 名錄（${all.length}）`);
      all.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
    }
    {
      const note = formatMembershipNote(input.question, all, rec, norec, lang);
      if (note) lines.push('', note);
    }
  } else if (lang === 'en') {
    lines.push(`# Location`);
    lines.push(`- Work: ${input.titleZh} (${input.workCode})`);
    if (juan) lines.push(`- Juan: ${juan}`);
    if (ref) lines.push(`- Ref: ${ref}`);
    lines.push(`- Heading: ${heading}`);
    lines.push('');
    if (rec.length || norec.length) {
      lines.push(`## Recorded with circumstances 見錄 (${rec.length})`);
      rec.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
      lines.push('');
      lines.push(`## Listed without recorded sayings 不錄 (${norec.length})`);
      norec.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
    } else {
      lines.push(`## Names (${all.length})`);
      all.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
    }
    {
      const note = formatMembershipNote(input.question, all, rec, norec, lang);
      if (note) lines.push('', note);
    }
  } else {
    lines.push(`PHẦN 1`);
    lines.push('');
    lines.push(`### Vị trí nguồn`);
    lines.push(`- Tác phẩm: ${input.titleZh} (${input.workCode})`);
    if (juan) lines.push(`- ${juan}`);
    if (ref) lines.push(`- cbeta_ref: ${ref}`);
    lines.push(`- Mục: ${heading}`);
    lines.push(`- Định vị: ${loc}`);
    lines.push('');
    if (rec.length || norec.length) {
      lines.push(
        `### Danh sách 見錄 — có cơ duyên được ghi (${rec.length} người)`,
      );
      rec.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
      lines.push('');
      lines.push(
        `### Danh sách 不錄 — vô cơ duyên chỉ liệt tên (${norec.length} người)`,
      );
      norec.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
      lines.push('');
      lines.push(
        `Tổng theo thứ tự kinh văn: ${all.length} tên (見錄 ${rec.length} + 不錄 ${norec.length}).`,
      );
    } else {
      lines.push(`### Danh sách theo thứ tự kinh văn (${all.length})`);
      all.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
    }
    const membershipNote = formatMembershipNote(input.question, all, rec, norec, lang);
    if (membershipNote) lines.push('', membershipNote);
    lines.push('');
    lines.push(
      `PHẦN 2: Trích theo văn bản đã định vị trong ${input.workCode}; không dùng danh sách tần suất toàn kho.`,
    );
  }

  let out = lines.join('\n');
  if (out.length > budget) {
    out = out.slice(0, budget) + '\n…';
  }
  return out;
}

/**
 * If the question asks whether a named master is in the register, state
 * 見錄 / 不錄 / absent explicitly (including Latin fabrication probes).
 */
function formatMembershipNote(
  question: string,
  all: string[],
  rec: string[],
  norec: string[],
  lang: CbetaAnswerLang,
): string | null {
  const q = (question || '').trim();
  if (!q) return null;
  const latinFake = q.match(/\b(FakeMaster\d*|[A-Za-z]{3,}\d{2,})\b/);
  if (latinFake) {
    const name = latinFake[1];
    if (lang === 'zh') return `結論：名錄中未見「${name}」。`;
    if (lang === 'en') return `Conclusion: 「${name}」 is not in this register.`;
    return `Kết luận: không thấy「${name}」trong mục 見錄/不錄 này.`;
  }
  // Prefer longer CJK person-like spans from the question.
  const cjkNames = q.match(
    /[\u3400-\u9fff]{2,18}(?:禪師|和尚|大師|坐主)?/gu,
  );
  if (!cjkNames?.length) return null;
  const skip = /見錄|不錄|五十六|馬祖法嗣|第二世|景德|傳燈/;
  const candidate = [...cjkNames]
    .filter((n) => !skip.test(n))
    .sort((a, b) => b.length - a.length)[0];
  if (!candidate || candidate.length < 3) return null;
  const hit =
    all.find((n) => n.includes(candidate) || candidate.includes(n)) || null;
  if (!hit) {
    if (lang === 'zh') return `結論：名錄中未見「${candidate}」。`;
    if (lang === 'en') {
      return `Conclusion: 「${candidate}」 is not in this register.`;
    }
    return `Kết luận: không thấy「${candidate}」trong mục 見錄/不錄 này.`;
  }
  if (rec.some((n) => n.includes(hit) || hit.includes(n))) {
    if (lang === 'zh') return `結論：「${hit}」屬見錄。`;
    if (lang === 'en') return `Conclusion: 「${hit}」 is in 見錄 (recorded).`;
    return `Kết luận:「${hit}」thuộc 見錄 (có cơ duyên được ghi).`;
  }
  if (norec.some((n) => n.includes(hit) || hit.includes(n))) {
    if (lang === 'zh') return `結論：「${hit}」屬不錄（無機緣語句）。`;
    if (lang === 'en') {
      return `Conclusion: 「${hit}」 is in 不錄 (listed without sayings).`;
    }
    return `Kết luận:「${hit}」thuộc 不錄 (vô cơ duyên chỉ liệt tên).`;
  }
  return null;
}

export type { CbetaAnswerLang };
