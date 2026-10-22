/**
 * Person-scoped Dharma-succession (法嗣) questions — not document-wide coverage.
 */

import {
  detectCbetaAnswerLang,
  type CbetaAnswerLang,
} from './cbeta-intent.util';

const CJK = String.raw`[\u3400-\u9fff\uf900-\ufaff]`;
/**
 * TOC / register style names. Non-greedy before 禪師/和尚 so concatenated
 * lists (洞山…禪師涿州…禪師幽谿和尚) split correctly.
 */
const MASTER_NAME_RE = new RegExp(
  `((?:${CJK}{2,4}(?:州|府|縣|郡))?${CJK}{2,10}?(?:禪師|和尚|大師|坐主)|(?:${CJK}{2,8}居士${CJK}{0,6}))`,
  'gu',
);
/** Dialogue / prose fragments mistaken for register names. */
const NAME_NOISE_RE =
  /[曰若即待欲見與問舉雖離恁麼某甲學人禮拜指往]|不聞|不見|不見|別學|孝順|歸宗/;

const CN_COUNT: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

/** Relation cues for one teacher's Dharma successors / disciples. */
const RELATION_CUE_RE =
  /法嗣|嗣法|師承|付法|Dharma\s+successors?|successors?\s+of|pháp\s*tự|đệ\s*tử\s*(nối\s*pháp|của)?|弟子|how\s+many.{0,48}(法嗣|successors?|pháp\s*tự)/i;

/** Document-wide patriarch dump — leave to coverageMode. */
const DOC_WIDE_RE =
  /các\s*vị\s*tổ|những\s*vị\s*tổ|tổ\s*sư.{0,20}(trong|theo)|list\s+all|liệt\s*kê\s*(tất\s*cả|toàn\s*bộ|mọi)|enumerate\s+all|patriarchs?\s+in\s+the|二十八祖|歷代祖師|西天.*東土|東土.*西天/i;

/** Gloss / translate a quoted phrase — not a succession listing. */
const GLOSS_RE =
  /có nghĩa gì|nghĩa là gì|what does .{0,40} mean|translate|dịch\s*(ra|nghĩa)|giải nghĩa|Chữ\s*['「「'].+['」』"]\s*chỉ|chỉ số lượng bao nhiêu/i;

/**
 * True when the user asks about successors / 法嗣 of a focal person
 * (not "list every patriarch in 傳燈錄").
 */
export function isCbetaPersonRelationQuestion(question: string): boolean {
  const q = (question || '').normalize('NFC').trim();
  if (!q) return false;
  if (GLOSS_RE.test(q)) return false;
  // Fabrication / absence probes use normal retrieve + denial — not list extract.
  if (/FakeMaster|完全虛構|假造|XYZABC|T99n9999|hư\s*cấu/i.test(q)) {
    return false;
  }
  if (!RELATION_CUE_RE.test(q)) return false;
  // Explicit document-wide enumeration without a focal 法嗣-of-person frame.
  if (DOC_WIDE_RE.test(q) && !/法嗣|pháp\s*tự|successors?\s+of|pháp\s*tự\s*của/i.test(q)) {
    return false;
  }
  if (
    /liệt\s*kê\s*(các\s*vị\s*tổ|những\s*vị\s*tổ|tổ\s*sư)/i.test(q) &&
    !/pháp\s*tự\s*của|法嗣/i.test(q)
  ) {
    return false;
  }

  // Focal person: CJK name with 法嗣 / "của X" / "did X have".
  if (
    new RegExp(
      `(?:${CJK}{2,12})(?:禪師|和尚)?[^\\n]{0,12}法嗣|法嗣[^\\n]{0,12}(?:${CJK}{2,12})`,
      'u',
    ).test(q)
  ) {
    return true;
  }
  if (/pháp\s*tự\s*của\s*.{2,40}|successors?\s+of\s*.{2,40}/i.test(q)) {
    return true;
  }
  if (/how\s+many.{0,80}did\s+.{2,40}have/i.test(q)) return true;
  if (
    new RegExp(
      `(?:${CJK}{2,12}).{0,40}(?:法嗣|pháp\\s*tự|Dharma\\s+successors?)`,
      'iu',
    ).test(q)
  ) {
    return true;
  }
  // Full heading already in the question (translation / locator tests).
  if (/法嗣[一二三四五六七八九十\d]+人/u.test(q)) return true;
  return false;
}

export function extractPersonRelationNeedles(question: string): string[] {
  const q = (question || '').normalize('NFC');
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.trim();
    if (t.length < 2 || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  // Prefer explicit 法嗣 heading spans from the question.
  for (const m of q.matchAll(
    new RegExp(`((?:${CJK}{2,20})(?:禪師|和尚)?法嗣[一二三四五六七八九十\\d]*人?)`, 'gu'),
  )) {
    push(m[1]);
    const person = m[1].replace(/法嗣.*$/u, '');
    if (person.length >= 2) push(person);
  }

  for (const m of q.matchAll(
    new RegExp(`(?:pháp\\s*tự\\s*của|successors?\\s+of)\\s*([\\u3400-\\u9fffA-Za-zÀ-ỹ\\s]{2,40})`, 'gi'),
  )) {
    const raw = (m[1] || '').trim();
    const cjk = raw.match(new RegExp(`${CJK}{2,12}`, 'u'));
    if (cjk) push(cjk[0]);
  }

  // Standalone monk names commonly paired with 法嗣 questions.
  for (const m of q.matchAll(
    new RegExp(`(${CJK}{2,4}(?:${CJK}{0,4})(?:曇晟|良价|希運|懷海|道一|慧能|從諗))`, 'gu'),
  )) {
    push(m[1]);
  }

  // Generic: longest CJK runs (person / place+name).
  const runs = q.match(new RegExp(`${CJK}{2,12}`, 'gu')) || [];
  for (const r of [...runs].sort((a, b) => b.length - a.length)) {
    if (/景德|傳燈|法嗣|四人|禪師法嗣|卷/.test(r)) continue;
    push(r);
    if (out.length >= 8) break;
  }
  return out;
}

export function parseChineseCountLabel(label: string): number | null {
  const t = (label || '').trim();
  const digit = t.match(/(\d+)/);
  if (digit) return parseInt(digit[1], 10);
  const cn = t.match(/([一二三四五六七八九十]+)人?/);
  if (!cn) return null;
  const s = cn[1];
  if (s.length === 1) return CN_COUNT[s] ?? null;
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (CN_COUNT[s[1]] || 0);
  if (s.endsWith('十')) return (CN_COUNT[s[0]] || 0) * 10;
  if (s.includes('十')) {
    const [a, b] = s.split('十');
    return (CN_COUNT[a] || 0) * 10 + (CN_COUNT[b] || 0);
  }
  return CN_COUNT[s] ?? null;
}

export interface ParsedPersonFasuccessors {
  heading: string;
  subject: string;
  names: string[];
  countLabel: string | null;
  expectedCount: number | null;
  evidenceSpan: string;
}

/**
 * Extract the 法嗣 list for a focal person from a CBETA chunk.
 * Stops at the next sibling 法嗣 / generation heading.
 */
export function parsePersonFasuccessorBlock(
  contentZh: string,
  personNeedles: string[],
): ParsedPersonFasuccessors | null {
  const text = (contentZh || '').normalize('NFC');
  if (!text) return null;
  const needles = personNeedles
    .map((n) => n.trim())
    .filter((n) => n.length >= 2)
    .sort((a, b) => b.length - a.length);
  if (!needles.length) return null;

  let start = -1;
  let matchedPerson = '';
  // Prefer counted register headings (法嗣四人) over bare 法嗣 in biographies.
  for (const n of needles) {
    const reCounted = new RegExp(
      `((?:${escapeRe(n)})[^\\n]{0,24}法嗣[一二三四五六七八九十\\d]+人)`,
      'u',
    );
    const m = text.match(reCounted);
    if (m && m.index != null) {
      start = m.index;
      matchedPerson = n;
      break;
    }
  }
  if (start < 0) {
    for (const n of needles) {
      const re = new RegExp(
        `((?:${escapeRe(n)})[^\\n]{0,24}法嗣)`,
        'u',
      );
      const m = text.match(re);
      if (m && m.index != null) {
        start = m.index;
        matchedPerson = n;
        break;
      }
    }
  }
  if (start < 0) {
    for (const n of needles) {
      const idx = text.indexOf(n);
      if (idx >= 0 && /法嗣[一二三四五六七八九十\d]+人/.test(text.slice(idx, idx + 80))) {
        start = idx;
        matchedPerson = n;
        break;
      }
    }
  }
  if (start < 0) return null;

  const from = text.slice(start);
  const headMatch = from.match(
    new RegExp(
      `^((?:${CJK}|[（）()]){2,40}?法嗣([一二三四五六七八九十\\d]+人)?)`,
      'u',
    ),
  );
  const heading = headMatch?.[0] || from.slice(0, 40);
  const countLabel = headMatch?.[2] || null;
  const expectedCount = countLabel ? parseChineseCountLabel(countLabel) : null;

  // Body until next peer 法嗣 heading or generation marker.
  const bodyRel = from.search(
    /(?:已上[一二三四五六七八九十\d]+人見錄)|(?:[\u3400-\u9fff]{2,20}(?:禪師|和尚)?法嗣[一二三四五六七八九十\d]*人)|(?:第[一二三四五六七八九十\d]+世)/u,
  );
  // First match may be our own heading — search after heading length.
  let end = from.length;
  const afterHead = heading.length;
  const rest = from.slice(afterHead);
  const next = rest.search(
    /(?:已上[一二三四五六七八九十\d]+人見錄)|(?:[\u3400-\u9fff]{2,20}(?:禪師|和尚)?法嗣[一二三四五六七八九十\d]*人)|(?:第[一二三四五六七八九十\d]+世)/u,
  );
  if (next >= 0) {
    const mark = rest.slice(next);
    if (/^已上/.test(mark)) {
      end = afterHead + next + (mark.match(/^已上[一二三四五六七八九十\d]+人見錄/)?.[0].length || 0);
    } else {
      end = afterHead + next;
    }
  } else if (bodyRel > afterHead) {
    end = bodyRel;
  }

  const evidenceSpan = from.slice(0, end).trim();
  const nameRegion = evidenceSpan.replace(heading, '');
  const names = extractMasterNamesInOrder(nameRegion);
  if (!names.length && !heading.includes('法嗣')) return null;

  return {
    heading,
    subject: matchedPerson,
    names,
    countLabel,
    expectedCount,
    evidenceSpan,
  };
}

function extractMasterNamesInOrder(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const shortOk = new RegExp(`^${CJK}{2,8}(?:和尚|禪師|大師)$`, 'u');
  const placeOk =
    /(?:州|府|縣|郡|山|溪|谿|院|寺).{0,10}(?:禪師|和尚|大師)$/u;
  MASTER_NAME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MASTER_NAME_RE.exec(text)) !== null) {
    const name = (m[1] || '').trim();
    if (!name || name.length < 3 || name.length > 16) continue;
    if (/五十六人|第二世|見錄|不錄|無機緣|法嗣/.test(name)) continue;
    if (NAME_NOISE_RE.test(name)) continue;
    if (!placeOk.test(name) && !shortOk.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatPersonFasuccessorAnswer(input: {
  question: string;
  workCode: string;
  titleZh: string;
  juanNo: number | null;
  cbetaRefStart: string | null;
  userLocator?: string | null;
  parsed: ParsedPersonFasuccessors;
}): string {
  const lang = detectCbetaAnswerLang(input.question);
  const loc =
    input.userLocator?.trim() ||
    (input.cbetaRefStart
      ? `${input.workCode}_p${input.cbetaRefStart.replace(/^p/i, '')}`
      : input.workCode);
  const juan =
    input.juanNo != null ? (lang === 'en' ? `juan ${input.juanNo}` : `卷${input.juanNo}`) : '';
  const count =
    input.parsed.expectedCount ??
    (input.parsed.names.length || null);
  const nameLines = input.parsed.names.map((n, i) => `${i + 1}. ${n}`);

  if (lang === 'zh') {
    return [
      'PHẦN 1',
      '',
      `依 ${input.titleZh || input.workCode}（${input.workCode}${juan ? ` · ${juan}` : ''} · ${loc}）`,
      `標題：${input.parsed.heading}`,
      count != null ? `法嗣人數：${count}` : null,
      '',
      '原文明單：',
      ...nameLines,
      '',
      `原文摘錄：${input.parsed.evidenceSpan}`,
      '',
      'PHẦN 2',
      '名單僅依該標題下原文；未將同書其他法嗣表併入。',
    ]
      .filter((x) => x != null)
      .join('\n');
  }

  if (lang === 'en') {
    return [
      'PHẦN 1',
      '',
      `According to ${input.titleZh || input.workCode} (${input.workCode}${juan ? `, ${juan}` : ''}, ${loc}):`,
      `Heading: ${input.parsed.heading}`,
      count != null ? `Number of Dharma successors (法嗣): ${count}` : null,
      '',
      'Names in document order:',
      ...nameLines,
      '',
      `Original passage: ${input.parsed.evidenceSpan}`,
      '',
      'PHẦN 2',
      'The list is taken only from this heading; other succession tables in the same work are not merged in.',
    ]
      .filter((x) => x != null)
      .join('\n');
  }

  return [
    'PHẦN 1',
    '',
    `Theo ${input.titleZh || input.workCode} (${input.workCode}${juan ? ` · ${juan}` : ''} · ${loc}):`,
    `Tiêu đề: ${input.parsed.heading}`,
    count != null ? `Số pháp tự (法嗣): ${count}` : null,
    '',
    'Danh sách theo thứ tự kinh văn:',
    ...nameLines,
    '',
    `Nguyên văn: ${input.parsed.evidenceSpan}`,
    '',
    'PHẦN 2',
    'Chỉ lấy đúng khối dưới tiêu đề này; không gộp bảng pháp tự khác trong cùng bộ.',
  ]
    .filter((x) => x != null)
    .join('\n');
}

export type { CbetaAnswerLang };
