/**
 * Scripture-oriented intents: explain / translate / terminology / quote verify.
 * These must NOT fall into coverage or personRelation dumps.
 */

/** Exact-quote / provenance verification. */
export function isCbetaQuoteVerifyIntent(question: string): boolean {
  const q = (question || '').trim();
  if (!q) return false;
  return /có thật|có trong kinh|xuất xứ|nguồn gốc câu|verify|is\s+this\s+(?:a\s+)?(?:real|authentic)|did\s+the\s+buddha\s+(?:really\s+)?(?:say|teach)|真的是|是否出自|出處|有沒有這句|có phải đức phật (?:đã )?dạy/i.test(
    q,
  );
}

/** Explain a passage / teaching in context (giải kinh). */
export function isCbetaScriptureExplainIntent(question: string): boolean {
  const q = (question || '').trim();
  if (!q) return false;
  if (isCbetaQuoteVerifyIntent(q)) return false;
  return /giải thích|giải nghĩa|nghĩa là gì|có nghĩa gì|ý nghĩa|giảng|explain|what\s+does|meaning\s+of|解釋|释义|何義|云何|phải không\?|có phải.{0,40}không|lời\s*(?:phật|đức\s*phật)|theo\s+nguyên\s*văn|kinh\s+hay\s+luận|sutra\s+or\s+treatise|kệ\s+(?:của\s+)?(?:long\s*thọ|nāgārjuna)|là\s+kệ|attribute\s+(?:to|as)/i.test(
    q,
  );
}

/**
 * Map vernacular / English scripture cues → CJK title fragments for ranking.
 * Does not hardcode interpretations — only retrieval preference by title match.
 */
const SCRIPTURE_TITLE_ALIAS: Array<{ re: RegExp; cues: string[] }> = [
  { re: /pháp\s*hoa|法華|lotus\s+sutra|妙法蓮華/i, cues: ['法華', '蓮華'] },
  { re: /kim\s*cang|金剛|diamond\s+sutra/i, cues: ['金剛'] },
  { re: /tâm\s*kinh|心經|heart\s+sutra|般若波羅蜜多心經/i, cues: ['心經'] },
  { re: /trung\s*luận|中論|madhyamaka|nāgārjuna|long\s*thọ/i, cues: ['中論'] },
  { re: /hoa\s*nghiêm|華嚴|avatamsaka|avataṃsaka/i, cues: ['華嚴'] },
  { re: /a[\s-]*di[\s-]*đà|阿彌陀|amitābha|純土|tịnh\s*độ/i, cues: ['阿彌陀'] },
  { re: /duy\s*thức|成唯識|yogācāra|duy thức/i, cues: ['唯識'] },
  { re: /a[\s-]*hàm|阿含|āgama/i, cues: ['阿含'] },
  { re: /niết[\s-]*bàn|涅槃|nirvana/i, cues: ['涅槃'] },
  { re: /duy\s*ma|維摩|vimalakīrti/i, cues: ['維摩'] },
];

/** CJK title tokens implied by the question (aliases + embedded CJK). */
export function extractScriptureTitleCues(question: string): string[] {
  const q = (question || '').normalize('NFC');
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.trim();
    if (t.length < 2 || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const row of SCRIPTURE_TITLE_ALIAS) {
    if (row.re.test(q)) row.cues.forEach(push);
  }
  for (const m of q.match(/[\u3400-\u9fff]{2,8}/g) || []) push(m);
  return out;
}

export function titleCueAffinity(titleZh: string, cues: string[]): number {
  const title = titleZh || '';
  if (!title || !cues.length) return 0;
  return cues.reduce((n, c) => n + (title.includes(c) ? c.length : 0), 0);
}

/** Classical ↔ Vietnamese translation focus. */
export function isCbetaTranslateIntent(question: string): boolean {
  const q = (question || '').trim();
  if (!q) return false;
  return /dịch|translate|bản dịch|phiên dịch|漢譯|翻譯|literal translation|dịch sát|dịch thoát/i.test(
    q,
  );
}

/** Buddhist technical term definition. */
export function isCbetaTerminologyIntent(question: string): boolean {
  const q = (question || '').trim();
  if (!q) return false;
  return /thuật ngữ|định nghĩa|nghĩa của từ|what\s+is\s+(?:the\s+)?(?:meaning\s+of\s+)?|vô thường|vô ngã|duyên khởi|như lai tạng|a-lại-da|tứ thánh đế|thập nhị nhân duyên|ngũ uẩn|ba-la-mật|無常|無我|緣起|空性|佛性|如來藏|阿賴耶|四聖諦|十二因緣|五蘊|般若/i.test(
    q,
  );
}

/**
 * Long CJK spans from the question usable as exact phrase needles
 * (prefer longer first).
 */
export function extractScripturePhraseNeedles(question: string): string[] {
  const q = (question || '').normalize('NFC');
  const quoted =
    q.match(/[「『"“]([\u3400-\u9fff，。、；：？！\s]{4,40})[」』"”]/g) || [];
  const fromQuotes = quoted
    .map((s) => s.replace(/^[「『"“]|[」』"”]$/g, '').replace(/\s+/g, ''))
    .filter((s) => s.length >= 4);
  const runs = q.match(/[\u3400-\u9fff]{4,24}/g) || [];
  const all = [...fromQuotes, ...runs];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of all.sort((a, b) => b.length - a.length)) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Intent brief block for scripture-grounded answers (原文 / 文義 / 註疏). */
export function scriptureGroundingBrief(question: string): string {
  const quote = isCbetaQuoteVerifyIntent(question);
  const explain = isCbetaScriptureExplainIntent(question);
  const translate = isCbetaTranslateIntent(question);
  const term = isCbetaTerminologyIntent(question);
  const lines = [
    'SCRIPTURE_GROUNDING (AUTHORITATIVE):',
    '依經解義 — explain only from retrieved CBETA blocks; 離經一字 — do not invent doctrine, quotations, work_codes, or locators.',
    'Separate layers internally: (1) 原文 exact wording in context, (2) 文義 literal/contextual meaning, (3) 義理/註疏 only if a commentary block is present — attribute commentator, never as Buddha speech.',
    'Genre: 經≠論≠疏≠語錄≠燈錄 — do not call a lamp/commentary passage a sutra teaching of the Buddha.',
    'If evidence is insufficient: say so in ANSWER_LANG and stop — no speculative fill-in.',
  ];
  if (quote) {
    lines.push(
      'QUOTE_VERIFY: check whether the quoted CJK appears verbatim (or clear orthographic variant) in evidence; state match / partial / not found; never invent a source.',
    );
  }
  if (explain) {
    lines.push(
      'EXPLAIN: reject oversimplification that contradicts the passage (e.g. equating 空 with mere non-existence, or 無住 with “do nothing”) unless the retrieved text itself supports that reading.',
    );
  }
  if (translate) {
    lines.push(
      'TRANSLATE: distinguish translation from commentary; preserve negations and technical terms; do not add doctrines absent from the source passage.',
    );
  }
  if (term) {
    lines.push(
      'TERMINOLOGY: define the term in the source context(s) retrieved; note tradition differences only with evidence; do not collapse distinct uses into one.',
    );
  }
  return lines.join('\n');
}
