/** Expand query terms for FTS / ranking (Vietnamese Zen corpus). */
const ALIAS_GROUPS: string[][] = [
  ['nghi', 'nghi tình', 'chơn nghi', 'nghi căn'],
  ['ngộ', 'giác ngộ', 'đốn ngộ', 'khai ngộ', 'minh tâm', 'kiến tánh'],
  ['thoại', 'thoại đầu', 'thoại vĩ', 'câu thoại'],
  ['thiền', 'tham thiền', 'tổ sư thiền'],
  ['hôn trầm', 'tán loạn'],
  ['phật', 'phật tánh', 'bản tánh', 'tự tánh'],
  ['bốn', '4', 'tứ'],
  ['bệnh', 'thiền bệnh', 'ba thứ bệnh', 'chấp thành bệnh'],
  ['tam bảo', 'tam bao', 'quy y', 'tự quy y'],
];

/** Known figures — enriches parsed segments, not the only signal. */
const FIGURE_PHRASES: string[][] = [
  ['bác sơn', 'bác sơn thiền sư', 'hòa thượng bác sơn', 'đại sư bác sơn'],
  ['lai quả', 'lai quả thiền sư'],
  ['hư vân', 'hư vân thiền sư'],
  ['lục tổ', 'lục tổ huệ năng', 'huệ năng', 'ngài lục tổ'],
  ['minh bổn', 'minh bổn thiền sư', 'trung phong'],
  ['nguyệt khê', 'nguyệt khê thiền sư'],
  ['động sơn', 'vân môn', 'triệu châu', 'lâm tế', 'bá trượng'],
];

/** Corpus wording may differ from user phrasing. */
const TOPIC_VARIANTS: Record<string, string[]> = {
  'thiền bệnh': [
    'thiền bệnh',
    'ba thứ bệnh',
    'chấp thành bệnh',
    'pháp thân bệnh',
    'ngâm nước chết',
    'cảnh ngữ về thiền bệnh',
  ],
  'thoại đầu': ['thoại đầu', 'câu thoại', 'câu thoại đầu'],
  'nghi tình': ['nghi tình', 'chơn nghi', 'nghi căn'],
  'quy y tam bảo': [
    'quy y tam bảo',
    'quy y tam bao',
    'tự quy y',
    'thường trụ tam bảo',
    'tự tánh tam bảo',
    'quy y đại thừa',
    'quy y phật',
    'quy y pháp',
    'quy y tăng',
    'tam bảo',
  ],
  'từ nghi đến ngộ': ['từ nghi đến ngộ', 'nghi đến ngộ', 'nghi ngộ'],
  'sinh tử': ['sinh tử', 'sanh tử', 'luân hồi', 'chết đi về đâu'],
  'tự tánh': ['tự tánh', 'phật tánh', 'bản tánh', 'tánh phật', 'tánh tâm', 'tánh tánh'],
};

export interface QuerySignals {
  keywords: string[];
  /** AND groups for co-occurrence SQL (≥1 term hit per group). */
  mustGroups: string[][];
  /** Prefer passages from these scripture titles (e.g. Pháp Bảo Đàn, not only Ngữ Lục). */
  sourceHints: string[];
  /** Topic terms for primary-source search. */
  topicTerms: string[];
}

const FILLER_WORDS = new Set([
  'ngài', 'nói', 'về', 'thế', 'nào', 'gì', 'sao', 'như', 'cho', 'biết',
  'theo', 'trong', 'của', 'là', 'có', 'không', 'được', 'khi', 'ai', 'đâu',
  'xin', 'hỏi', 'tra', 'cứu',
]);

const FLUFF_RE =
  /\s+(như thế nào|ra sao|là gì|là sao|nghĩa là gì|có nghĩa gì|\?.*)$/u;

const HONORIFIC_RE = /^(?:ngài|ht\.?|hòa thượng|thiền sư|đại sư|tổ)\s+/u;

function normalizeQuery(query: string): string {
  return query
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimFluff(phrase: string): string {
  return phrase.replace(FLUFF_RE, '').replace(HONORIFIC_RE, '').trim();
}

/** Parse common Vietnamese question shapes without hardcoding every Q&A. */
function parseStructuredQuery(lower: string): { figure?: string; topic?: string } {
  const out: { figure?: string; topic?: string } = {};

  const theo = lower.match(
    /\btheo\s+(?:ngài\s+|ht\.?\s+|hòa thượng\s+|thiền sư\s+)?(.+)$/u,
  );
  if (theo) out.figure = trimFluff(theo[1]);

  const topicTheo = lower.match(
    /(?:thế nào là|là gì|nghĩa là|nghĩa của|ý nghĩa(?: của)?)\s+(.+?)\s+theo\b/u,
  );
  if (topicTheo) out.topic = trimFluff(topicTheo[1]);

  const sayAbout = lower.match(
    /(?:ngài\s+|ht\.?\s+|hòa thượng\s+|thiền sư\s+)?(.+?)\s+(?:nói|dạy|giải|bàn)\s+về\s+(.+)$/u,
  );
  if (sayAbout) {
    out.figure = out.figure ?? trimFluff(sayAbout[1]);
    out.topic = out.topic ?? trimFluff(sayAbout[2]);
  }

  if (!out.topic) {
    const laGi = lower.match(
      /(?:thế nào là|nghĩa là|nghĩa của|ý nghĩa(?: của)?)\s+(.+)$/u,
    );
    if (laGi) out.topic = trimFluff(laGi[1]);
  }

  if (!out.topic) {
    const tail = lower.match(/^(.+?)\s+(?:là gì|là sao|như thế nào|ra sao)\s*$/u);
    if (tail) out.topic = trimFluff(tail[1]);
  }

  if (out.topic && out.figure && out.topic.includes(out.figure)) {
    out.topic = out.topic.replace(out.figure, '').replace(/\btheo\b/g, '').trim();
  }

  return out;
}

function overlaps(a: string, b: string): boolean {
  return a.includes(b) || b.includes(a);
}

function enrichFromDict(phrase: string, groups: string[][]): string[] {
  const p = phrase.trim();
  if (!p) return [];
  const out = new Set<string>([p]);
  for (const tokens of tokenBigrams(p)) out.add(tokens);

  for (const group of groups) {
    if (group.some((g) => overlaps(p, g))) {
      group.forEach((g) => out.add(g));
    }
  }
  return [...out].slice(0, 14);
}

function enrichTopic(phrase: string): string[] {
  const p = phrase.trim();
  if (!p) return [];
  const out = new Set<string>([p]);
  for (const tokens of tokenBigrams(p)) out.add(tokens);

  for (const [key, variants] of Object.entries(TOPIC_VARIANTS)) {
    if (
      overlaps(p, key)
      || variants.some((v) => overlaps(p, v))
    ) {
      out.add(key);
      variants.forEach((v) => out.add(v));
    }
  }
  return [...out].slice(0, 14);
}

function tokenBigrams(phrase: string): string[] {
  const words = phrase.split(/\s+/).filter((w) => w.length >= 2);
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  if (words.length === 1 && words[0].length >= 3) bigrams.push(words[0]);
  return bigrams;
}

function findDictFigure(lower: string): string[] | null {
  let best: string[] | null = null;
  let bestLen = 0;
  for (const group of FIGURE_PHRASES) {
    for (const v of group) {
      if (lower.includes(v) && v.length > bestLen) {
        best = group;
        bestLen = v.length;
      }
    }
  }
  return best;
}

function findDictTopic(lower: string): string[] | null {
  let best: string[] | null = null;
  let bestLen = 0;
  for (const [key, variants] of Object.entries(TOPIC_VARIANTS)) {
    const all = [key, ...variants];
    for (const v of all) {
      if (lower.includes(v) && v.length > bestLen) {
        best = [key, ...variants];
        bestLen = v.length;
      }
    }
  }
  return best;
}

function mergeMustGroups(groups: string[][]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const g of groups) {
    const cleaned = [...new Set(g.map((t) => t.trim()).filter(Boolean))];
    if (cleaned.length < 1) continue;
    const key = cleaned.slice().sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function buildMustGroups(lower: string): string[][] {
  const parsed = parseStructuredQuery(lower);
  const groups: string[][] = [];

  if (parsed.figure) {
    groups.push(enrichFromDict(parsed.figure, FIGURE_PHRASES));
  } else {
    const dictFig = findDictFigure(lower);
    if (dictFig) groups.push(dictFig);
  }

  if (parsed.topic) {
    groups.push(enrichTopic(parsed.topic));
  } else {
    const dictTopic = findDictTopic(lower);
    if (dictTopic) groups.push(dictTopic);
  }

  return mergeMustGroups(groups);
}

/** Map figure/topic to the original scripture file, not HT Duy Lực commentary. */
function resolveSourceHints(lower: string, mustGroups: string[][]): string[] {
  const hints = new Set<string>();
  const blob = `${lower} ${mustGroups.flat().join(' ')}`;

  if (/pháp bảo đàn|phap bao dan|kinh pháp bảo đàn/.test(blob)) {
    hints.add('pháp bảo đàn');
  }
  if (/lục tổ|huệ năng|luc to|hue nang/.test(blob)) {
    hints.add('pháp bảo đàn');
  }
  if (/bác sơn|bac son/.test(blob)) {
    hints.add('phương pháp tu trì');
    hints.add('tham thiền cảnh ngữ');
  }
  if (/lâm tế|lam te/.test(blob)) {
    hints.add('lâm tế ngữ lục');
  }
  if (/hư vân|hu van/.test(blob)) {
    hints.add('yếu chỉ tham thiền');
  }
  if (/đường lối thực hành|duong loi thuc hanh|tham tổ sư thiền|tham to su thien/.test(blob)) {
    hints.add('tham tổ sư thiền');
    hints.add('đường lối thực hành tham tổ sư thiền');
  }
  return [...hints];
}

function extractTopicTerms(mustGroups: string[][]): string[] {
  if (mustGroups.length >= 2) return mustGroups[mustGroups.length - 1];
  if (mustGroups.length === 1) return mustGroups[0];
  return [];
}

function tokenizeContent(lower: string, stopWords: ReadonlySet<string>): string[] {
  return [...new Set(
    lower
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(
        (w) =>
          w.length >= 2
          && !stopWords.has(w)
          && !FILLER_WORDS.has(w),
      ),
  )].sort((a, b) => b.length - a.length);
}

export function expandKeywords(keywords: string[]): string[] {
  const out = new Set(keywords.filter((k) => k.length >= 2));
  const seeds = [...out].sort((a, b) => b.length - a.length);

  for (const kw of seeds) {
    for (const group of ALIAS_GROUPS) {
      const hit = group.some(
        (g) =>
          kw === g
          || (kw.length >= 3 && overlaps(kw, g)),
      );
      if (hit) group.forEach((g) => out.add(g));
    }
    for (const [, variants] of Object.entries(TOPIC_VARIANTS)) {
      if (variants.some((v) => kw === v || (kw.length >= 3 && overlaps(kw, v)))) {
        variants.forEach((v) => out.add(v));
      }
    }
  }
  return [...out].slice(0, 20);
}

export function questionStem(query: string): string {
  return normalizeQuery(query)
    .replace(/\b(là gì|là sao|như thế nào|ra sao|nghĩa là gì|có nghĩa gì)\b/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function analyzeQuery(
  query: string,
  stopWords: ReadonlySet<string>,
): QuerySignals {
  const lower = normalizeQuery(query);
  const mustGroups = buildMustGroups(lower);

  const phraseTokens = new Set<string>();
  for (const group of mustGroups) {
    group.forEach((t) => phraseTokens.add(t));
  }

  const tokens = tokenizeContent(lower, stopWords);
  const keywords = [...tokens];

  for (const t of phraseTokens) {
    if (!keywords.includes(t)) keywords.unshift(t);
  }

  for (const bi of tokenBigrams(lower)) {
    if (bi.length >= 5 && !keywords.includes(bi)) keywords.push(bi);
  }

  return {
    keywords: [...new Set(keywords)].slice(0, 12),
    mustGroups,
    sourceHints: resolveSourceHints(lower, mustGroups),
    topicTerms: extractTopicTerms(mustGroups),
  };
}
