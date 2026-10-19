/**
 * CBETA question intents: coverage (list/enumerate) vs brief summary.
 * Keep in sync with router — bare "toàn bộ kinh sách" is NOT coverage.
 */

/** Explicit list / patriarch enumerate (deep scan). */
const LIST_ENUM_RE =
  /liệt\s*kê|danh\s*sách|các\s*vị\s*tổ|những\s*vị\s*tổ|ngũ\s*gia|thất\s*tông|truyền\s*thừa.*(liệt|danh)|enumerate|list\s+all|西天.*祖|東土.*祖|二十八祖|歷代祖師/i;

/** "toàn bộ" only when clearly listing lineage / masters. */
const TOAN_BO_LINEAGE_RE =
  /toàn\s*bộ.+(tổ\s*sư|vị\s*tổ|các\s*tổ|祖師|ngũ\s*gia|thất\s*tông|truyền\s*thừa)/i;

/** User wants a short answer — do not deep-scan. */
export const CBETA_BRIEF_RE =
  /tóm\s*gọn|tóm\s*lược|tóm\s*tắt|ngắn\s*gọn|nói\s*ngắn|vài\s*câu|yếu\s*chỉ|đại\s*ý|cốt\s*lõi|cương\s*yếu|簡要|简要|略說|略说|要義|要义|in\s*brief|briefly|summarize|summary|in\s*short|key\s*point/i;

export function isCbetaBriefQuestion(question: string): boolean {
  return CBETA_BRIEF_RE.test((question || '').trim());
}

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;
const LATIN_LETTER_RE = /[A-Za-zÀ-ỹ]/g;
/** Vietnamese-specific letters (diacritics + đ) — distinguishes VI from EN. */
const VI_MARK_RE =
  /[àáạảãăằắặẳẵâầấậẩẫèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃĂẰẮẶẲẴÂẦẤẬẨẪÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/g;

export type CbetaAnswerLang = 'vi' | 'zh' | 'en';

/**
 * Detect answer language from the user question.
 * Pipeline: any input → rewrite to Hán for retrieval → answer in this language.
 */
export function detectCbetaAnswerLang(question: string): CbetaAnswerLang {
  const q = (question || '').trim();
  if (!q) return 'vi';
  const cjk = (q.match(CJK_RE) || []).length;
  const latin = (q.match(LATIN_LETTER_RE) || []).length;
  const viMarks = (q.match(VI_MARK_RE) || []).length;
  if (cjk > 0 && cjk >= latin) return 'zh';
  if (latin > 0 && viMarks === 0 && cjk === 0) return 'en';
  if (viMarks > 0) return 'vi';
  // Mixed Latin without VI marks but some CJK → prefer dominant script.
  if (latin > cjk) return 'en';
  if (cjk > 0) return 'zh';
  return 'vi';
}

export function isCbetaMostlyChineseQuestion(question: string): boolean {
  return detectCbetaAnswerLang(question) === 'zh';
}

export function cbetaEmptyHitMessage(question: string): string {
  switch (detectCbetaAnswerLang(question)) {
    case 'zh':
      return '在目前已選的 CBETA 資料範圍內，未見相關內容。';
    case 'en':
      return 'No matching content was found in the selected CBETA scope.';
    default:
      return 'Trong tư liệu CBETA hiện có (phạm vi đã chọn) chưa thấy nội dung này.';
  }
}

export function cbetaAnswerLangBrief(lang: CbetaAnswerLang): string {
  switch (lang) {
    case 'zh':
      return 'ANSWER_LANG=zh — write PHẦN 1 + PHẦN 2 entirely in Chinese (same script as the question). Do not use Vietnamese.';
    case 'en':
      return 'ANSWER_LANG=en — write PHẦN 1 + PHẦN 2 entirely in English, synthesizing/translating from CBETA Hán context. Do NOT use Vietnamese at all; keep key Classical Chinese terms in parentheses when helpful.';
    default:
      return 'ANSWER_LANG=vi — write PHẦN 1 + PHẦN 2 in Vietnamese; Classical Chinese terms may appear in parentheses.';
  }
}

/**
 * Deep coverage / lamp multi-pass only for real list-enumerate intents.
 * "yếu chỉ của toàn bộ kinh sách… tóm gọn" → false (fast retrieve).
 */
export function isCbetaCoverageIntent(question: string): boolean {
  const q = (question || '').trim();
  if (!q) return false;
  // Summary / essence questions must stay on fast path.
  if (isCbetaBriefQuestion(q) && !LIST_ENUM_RE.test(q)) {
    return false;
  }
  if (LIST_ENUM_RE.test(q)) return true;
  if (TOAN_BO_LINEAGE_RE.test(q)) return true;
  return false;
}
