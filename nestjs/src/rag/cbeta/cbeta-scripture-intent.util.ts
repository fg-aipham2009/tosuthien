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
  return /giải thích|giải nghĩa|nghĩa là gì|có nghĩa gì|ý nghĩa|giảng|explain|what\s+does|meaning\s+of|解釋|释义|何義|云何|phải không\?|có phải.{0,40}không/i.test(
    q,
  );
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
