/**
 * Query expansion for Tổ Sư Thiền corpus (HT. Thích Duy Lực).
 * Terms mirror wording in text/*.txt — especially Đường lối thực hành,
 * Tham Thiền Phổ Thuyết, Duy Lực Ngữ Lục, Danh Từ Thiền Học, Pháp Bảo Đàn.
 */

/** Synonym / near-synonym clusters for FTS + ranking. */
const ALIAS_GROUPS: string[][] = [
  // Core practice
  ['thoại đầu', 'tham thoại đầu', 'khán thoại đầu', 'câu thoại', 'câu thoại đầu', 'thoại'],
  ['thoại vĩ', 'đuôi thoại', 'đã khởi niệm'],
  ['nghi tình', 'chơn nghi', 'nghi căn', 'nghi', 'cái nghi', 'khởi nghi'],
  ['tham thiền', 'tọa thiền', 'tham tổ sư thiền', 'tổ sư thiền', 'thiền'],
  ['khán', 'khán thoại', 'nhìn chỗ không biết', 'nhìn vào chỗ không biết'],
  ['công án', 'câu công án', 'thoại đầu công án'],
  ['kiến tánh', 'minh tâm', 'minh tâm kiến tánh', 'ngộ đạo', 'kiến tánh thành phật'],
  ['ngộ', 'giác ngộ', 'đốn ngộ', 'khai ngộ', 'đại ngộ', 'tiểu ngộ'],
  ['hôn trầm', 'tán loạn', 'vọng tưởng', 'tán tâm'],
  ['thiền bệnh', 'ba thứ bệnh', 'chấp thành bệnh', 'pháp thân bệnh', 'ngâm nước chết'],
  ['cảnh ngữ', 'tham thiền cảnh ngữ'],

  // Nature / mind
  ['tự tánh', 'phật tánh', 'bản tánh', 'bản lai diện mục', 'bản lai', 'tánh phật', 'tánh tâm'],
  ['vô niệm', 'ly niệm', 'chẳng trụ niệm'],
  ['vô trụ', 'vô sở trụ', 'ứng vô sở trụ', 'không trụ'],
  ['nhất tâm', 'nhất niệm', 'chuyên nhất'],
  ['ý thức', 'thức thứ sáu', 'thức thứ bảy', 'mạt na', 'a lại da'],
  ['vô thủy vô minh', 'vô minh', 'căn bản vô minh'],
  ['đầu sào trăm thước', 'đầu sào', 'trăm thước đầu sào'],

  // Path / fruit
  ['bồ đề', 'vô thượng bồ đề', 'chánh đẳng chánh giác'],
  ['niết bàn', 'niết-bàn', 'tịch diệt'],
  ['sinh tử', 'sanh tử', 'luân hồi', 'sống chết'],
  ['bát nhã', 'trí tuệ bát nhã', 'bát nhã ba la mật'],
  ['pháp thân', 'báo thân', 'hóa thân', 'tam thân'],
  ['tam bảo', 'tam bao', 'quy y', 'tự quy y', 'tự tánh tam bảo'],

  // Scriptures / short maxims
  ['chí đạo', 'chí đạo vô nan', 'duy hiềm giản trạch', 'giản trạch'],
  ['kim cang', 'kinh kim cang', 'phàm sở hữu tướng', 'phàm có tướng', 'chư tướng phi tướng'],
  ['lăng nghiêm', 'kinh lăng nghiêm', 'thủ lăng nghiêm'],
  ['lăng già', 'kinh lăng già'],
  ['pháp bảo đàn', 'đàn kinh', 'kinh pháp bảo đàn'],
  ['bồ tát giới', 'giới bồ tát', 'thập trọng', 'tứ thập bát khinh', 'phạm võng'],

  // Famous gong'an wording variants
  ['chém mèo', 'chặt mèo', 'chém con mèo', 'chặt con mèo', 'nam tuyền chém mèo', 'giành con mèo'],
  ['bốn', '4', 'tứ'],
];

/** Known figures — enriches parsed segments, not the only signal. */
const FIGURE_PHRASES: string[][] = [
  ['duy lực', 'thích duy lực', 'ht duy lực', 'hòa thượng duy lực', 'ht. thích duy lực'],
  ['lục tổ', 'lục tổ huệ năng', 'huệ năng', 'ngài lục tổ', 'đại sư huệ năng'],
  ['nam tuyền', 'nam tuyền phổ nguyện', 'vương lão sư'],
  ['triệu châu', 'triệu châu tòng thẩm', 'con chó có phật tánh'],
  ['lâm tế', 'lâm tế nghĩa huyền', 'lâm tế ngữ lục'],
  ['trung phong', 'minh bổn', 'minh bổn thiền sư', 'trung phong pháp ngữ'],
  ['bác sơn', 'bác sơn thiền sư', 'hòa thượng bác sơn', 'đại sư bác sơn'],
  ['hư vân', 'hư vân thiền sư'],
  ['lai quả', 'lai quả thiền sư'],
  ['nguyệt khê', 'nguyệt khê thiền sư'],
  ['động sơn', 'động sơn lương giới'],
  ['vân môn', 'vân môn văn yển'],
  ['bá trượng', 'bách trượng', 'bá trượng hoài hải'],
  ['mã tổ', 'mã tổ đạo nhất'],
  ['hoàng bá', 'hoàng bá hy vận'],
  ['đạt ma', 'bồ đề đạt ma', 'sơ tổ đạt ma'],
  ['tăng triệu', 'tăng triệu', 'triệu luận'],
  ['tam tổ', 'tam tổ tăng xán', 'tăng xán', 'tín tâm minh'],
];

/** Corpus wording may differ from user phrasing. */
const TOPIC_VARIANTS: Record<string, string[]> = {
  'thoại đầu': [
    'thoại đầu',
    'tham thoại đầu',
    'khán thoại đầu',
    'câu thoại',
    'câu thoại đầu',
    'chưa khởi niệm',
    'đầu tiên lời nói',
  ],
  'thoại vĩ': ['thoại vĩ', 'đã khởi niệm muốn nói', 'đuôi của thoại'],
  'nghi tình': [
    'nghi tình',
    'chơn nghi',
    'nghi căn',
    'cái không biết',
    'chỗ không biết',
    'khởi nghi',
  ],
  'tham tổ sư thiền': [
    'tham tổ sư thiền',
    'tổ sư thiền',
    'tham thiền',
    'đường lối thực hành',
    'cách tham thiền',
    'phương pháp tham thiền',
  ],
  'kiến tánh': [
    'kiến tánh',
    'minh tâm kiến tánh',
    'minh tâm',
    'thấy tánh',
    'ngộ tự tánh',
  ],
  'thiền bệnh': [
    'thiền bệnh',
    'ba thứ bệnh',
    'chấp thành bệnh',
    'pháp thân bệnh',
    'ngâm nước chết',
    'cảnh ngữ về thiền bệnh',
    'hôn trầm',
    'tán loạn',
  ],
  'công án': ['công án', 'câu công án', 'thoại đầu công án'],
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
  'từ nghi đến ngộ': ['từ nghi đến ngộ', 'nghi đến ngộ', 'nghi ngộ', 'do nghi được ngộ'],
  'sinh tử': ['sinh tử', 'sanh tử', 'luân hồi', 'chết đi về đâu', 'sống chết'],
  'tự tánh': [
    'tự tánh',
    'phật tánh',
    'bản tánh',
    'bản lai diện mục',
    'tánh phật',
    'tánh tâm',
  ],
  'vô sở trụ': ['vô sở trụ', 'ứng vô sở trụ', 'vô trụ', 'không trụ vào đâu'],
  'kim cang': [
    'kim cang',
    'kinh kim cang',
    'phàm sở hữu tướng',
    'phàm có tướng',
    'chư tướng phi tướng',
    'ly tứ cú tuyệt bách phi',
  ],
  'chí đạo vô nan': [
    'chí đạo',
    'chí đạo vô nan',
    'duy hiềm giản trạch',
    'giản trạch',
    'tín tâm minh',
  ],
  'nam tuyền chém mèo': [
    'nam tuyền chém mèo',
    'nam tuyền chặt mèo',
    'chém mèo',
    'chặt mèo',
    'giành con mèo',
  ],
  'bồ tát giới': [
    'bồ tát giới',
    'giới bồ tát',
    'thập trọng',
    'tứ thập bát khinh',
    'phạm võng',
  ],
  'lăng nghiêm': ['lăng nghiêm', 'kinh lăng nghiêm', 'thủ lăng nghiêm', 'lược giảng kinh lăng nghiêm'],
  'lăng già': ['lăng già', 'kinh lăng già'],
  'pháp bảo đàn': ['pháp bảo đàn', 'đàn kinh', 'kinh pháp bảo đàn', 'lục tổ đàn kinh'],
};

export interface QuerySignals {
  keywords: string[];
  /** AND groups for co-occurrence SQL (≥1 term hit per group). */
  mustGroups: string[][];
  /** Prefer passages from these scripture titles. */
  sourceHints: string[];
  /** Topic terms for primary-source search. */
  topicTerms: string[];
}

const FILLER_WORDS = new Set([
  'ngài', 'nói', 'về', 'thế', 'nào', 'gì', 'sao', 'như', 'cho', 'biết',
  'theo', 'trong', 'của', 'là', 'có', 'không', 'được', 'khi', 'ai', 'đâu',
  'xin', 'hỏi', 'tra', 'cứu', 'giúp', 'mình', 'con', 'em', 'anh', 'chị',
  'bạn', 'với', 'nhé', 'ạ', 'ơi', 'làm', 'cách', 'những', 'các', 'một',
]);

const FLUFF_RE =
  /\s+(như thế nào|ra sao|là gì|là sao|nghĩa là gì|có nghĩa gì|như thế nào ạ|\?.*)$/u;

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
    /(?:ngài\s+|ht\.?\s+|hòa thượng\s+|thiền sư\s+)?(.+?)\s+(?:nói|dạy|giảng|giải|bàn|chỉ)\s+về\s+(.+)$/u,
  );
  if (sayAbout) {
    out.figure = out.figure ?? trimFluff(sayAbout[1]);
    out.topic = out.topic ?? trimFluff(sayAbout[2]);
  }

  const howTo = lower.match(
    /(?:làm sao|làm thế nào|cách(?: nào)?|phải(?: làm)? sao)\s+(?:để\s+)?(.+)$/u,
  );
  if (howTo && !out.topic) out.topic = trimFluff(howTo[1]);

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

/** Map figure/topic to scripture titles used in rag_sources.title. */
function resolveSourceHints(lower: string, mustGroups: string[][]): string[] {
  const hints = new Set<string>();
  const blob = `${lower} ${mustGroups.flat().join(' ')}`;

  if (/pháp bảo đàn|phap bao dan|kinh pháp bảo đàn|đàn kinh/.test(blob)) {
    hints.add('pháp bảo đàn');
  }
  if (/lục tổ|huệ năng|luc to|hue nang/.test(blob)) {
    hints.add('pháp bảo đàn');
  }
  if (/bác sơn|bac son|cảnh ngữ/.test(blob)) {
    hints.add('tham thiền phổ thuyết');
    hints.add('cội nguồn truyền thừa');
  }
  if (/lâm tế|lam te/.test(blob)) {
    hints.add('lâm tế ngữ lục');
    hints.add('trung phong');
  }
  if (/trung phong|minh bổn/.test(blob)) {
    hints.add('trung phong pháp ngữ');
  }
  if (/hư vân|hu van/.test(blob)) {
    hints.add('cội nguồn truyền thừa');
    hints.add('thiền thất khai thị lục');
  }
  if (
    /đường lối thực hành|duong loi thuc hanh|tham tổ sư thiền|tham to su thien|cách tham thiền|phương pháp tham/.test(
      blob,
    )
  ) {
    hints.add('tham tổ sư thiền');
    hints.add('đường lối thực hành tham tổ sư thiền');
    hints.add('tham thiền phổ thuyết');
  }
  if (/thoại đầu|nghi tình|khán thoại|tham thoại/.test(blob)) {
    hints.add('đường lối thực hành tham tổ sư thiền');
    hints.add('vũ trụ quan');
    hints.add('tham thiền phổ thuyết');
    hints.add('duy lực ngữ lục');
  }
  if (/kim cang|kinh kim cang/.test(blob)) {
    hints.add('lược giảng kinh kim cang');
    hints.add('kinh kim cang');
    hints.add('chư kinh tập yếu');
  }
  if (/nam tuyền|chém mèo|chặt mèo|bửu tạng luận|buu tang luan/.test(blob)) {
    hints.add('nam tuyền ngữ lục');
    hints.add('bửu tạng luận');
  }
  if (/bồ tát giới|bo tat gioi|thập trọng|tứ thập bát khinh|phạm võng/.test(blob)) {
    hints.add('lược giảng bồ tát giới');
    hints.add('bồ tát giới');
  }
  if (
    /duy lực ngữ lục/.test(blob)
    || (/duy lực/.test(blob) && /ngữ lục|quyển hạ|quyển thượng|tham thiền/.test(blob))
  ) {
    hints.add('duy lực ngữ lục');
  }
  if (/tín tâm minh|tin tam minh|chí đạo vô nan|giản trạch/.test(blob)) {
    hints.add('tín tâm minh');
    hints.add('lược giảng tín tâm minh');
  }
  if (/lăng nghiêm|lang nghiem/.test(blob)) {
    hints.add('kinh lăng nghiêm');
    hints.add('lược giảng kinh lăng nghiêm');
  }
  if (/lăng già|lang gia/.test(blob)) {
    hints.add('kinh lăng già');
  }
  if (/triệu luận|tăng triệu|tăng triệu/.test(blob)) {
    hints.add('triệu luận');
  }
  if (/danh từ thiền|thuật ngữ thiền/.test(blob)) {
    hints.add('danh từ thiền học');
  }
  if (/đại thừa tuyệt đối/.test(blob)) {
    hints.add('đại thừa tuyệt đối luận');
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
  return [...out].slice(0, 24);
}

export function questionStem(query: string): string {
  return normalizeQuery(query)
    .replace(/\b(là gì|là sao|như thế nào|ra sao|nghĩa là gì|có nghĩa gì)\b/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Short intent brief for the LLM user message (API-side "pre-prompt").
 * Helps map colloquial questions onto corpus terminology without a 2nd LLM call.
 */
export function buildIntentBrief(signals: QuerySignals): string {
  const lines: string[] = [];
  const topics = signals.topicTerms.slice(0, 8);
  if (topics.length) {
    lines.push(`Thuật ngữ Tổ Sư Thiền liên quan: ${topics.join(', ')}`);
  }
  if (signals.sourceHints.length) {
    lines.push(`Ưu tiên tra trong: ${signals.sourceHints.join('; ')}`);
  }
  const figures = signals.mustGroups
    .flat()
    .filter((t) =>
      FIGURE_PHRASES.some((g) => g.includes(t) || overlaps(t, g[0])),
    )
    .slice(0, 6);
  if (figures.length) {
    lines.push(`Nhân vật / tổ sư: ${[...new Set(figures)].join(', ')}`);
  }
  return lines.join('\n');
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
    keywords: [...new Set(keywords)].slice(0, 14),
    mustGroups,
    sourceHints: resolveSourceHints(lower, mustGroups),
    topicTerms: extractTopicTerms(mustGroups),
  };
}
