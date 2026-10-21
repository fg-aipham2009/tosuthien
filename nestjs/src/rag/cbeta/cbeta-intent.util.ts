/**
 * CBETA question intents: coverage (list/enumerate) vs brief summary.
 * Keep in sync with router — bare "toàn bộ kinh sách" is NOT coverage.
 */

/** Explicit list / patriarch enumerate (deep scan). */
const LIST_ENUM_RE =
  /liệt\s*kê|kể\s*tên|danh\s*sách|các\s*vị\s*tổ|những\s*vị\s*tổ|tổ\s*sư.{0,40}truyền\s*đăng|truyền\s*đăng.{0,40}(tổ|liệt|kể|danh)|ngũ\s*gia|thất\s*tông|truyền\s*thừa.*(liệt|danh|kể)|enumerate|list\s+all|list\s+(the\s+)?(chan\s+|zen\s+)?patriarchs?|patriarchs?\s+in\s+the|transmission\s+of\s+the\s+lamp|西天.*祖|東土.*祖|二十八祖|歷代祖師|傳燈錄.*祖|列出.*祖/i;

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

/**
 * Unaccented / common Vietnamese cues (telex-ish). Prefer VI over EN when these hit
 * so "thien la gi" is not classified as English. Avoid tokens that collide with English
 * (the, to, is, ban, …).
 */
const VI_WORD_RE =
  /\b(khong|duoc|nhung|nhieu|nguoi|nghia|thien|phat|phap|thoai|tom\s*gon|yeu\s*chi|dai\s*y|giai\s*thich|lam\s*sao|nhu\s*the\s*nao|la\s*gi|co\s*phai|tai\s*sao|vi\s*sao|hoi\s*dap|kinh\s*sach|ngu\s*luc|cong\s*an|to\s*su|nghi\s*tinh|kien\s*tanh|tham\s*thien|phap\s*bao|duy\s*luc)\b/i;

/** Clear English-only cues (used only when no VI / CJK signals). */
const EN_WORD_RE =
  /\b(what|who|where|when|why|how|which|is|are|was|were|the|this|that|with|from|about|please|explain|practice|meaning|summary|briefly|chan|zen|buddha|sutra|koan)\b/i;

export type CbetaAnswerLang = 'vi' | 'zh' | 'en';

function hasVietnameseSignal(q: string, viMarks: number): boolean {
  if (viMarks > 0) return true;
  return VI_WORD_RE.test(q);
}

/**
 * Detect answer language from the user question.
 * Priority (user rule): Vietnamese if any VI signal → Chinese if CJK → English only if clearly EN → default VI.
 * Pipeline: any input → rewrite to Hán for retrieval → answer in this language.
 */
export function detectCbetaAnswerLang(question: string): CbetaAnswerLang {
  const q = (question || '').trim();
  if (!q) return 'vi';
  const cjk = (q.match(CJK_RE) || []).length;
  const latin = (q.match(LATIN_LETTER_RE) || []).length;
  const viMarks = (q.match(VI_MARK_RE) || []).length;
  const viSignal = hasVietnameseSignal(q, viMarks);

  // 1) Any Vietnamese (có dấu hoặc không dấu) → luôn trả lời tiếng Việt.
  if (viSignal) return 'vi';

  // 2) Chinese / Hán dominant (no VI) → tiếng Trung.
  if (cjk > 0 && cjk >= Math.max(1, Math.floor(latin * 0.5))) return 'zh';
  if (cjk > 0 && latin === 0) return 'zh';

  // 3) English only when clearly English and no VI/CJK.
  if (latin > 0 && cjk === 0 && EN_WORD_RE.test(q)) return 'en';

  // 4) Ambiguous Latin → default Vietnamese (product audience).
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
      return 'ANSWER_LANG=zh (AUTHORITATIVE) — PHẦN 1 + PHẦN 2 MUST be Chinese only (same script as the question). FORBIDDEN: Vietnamese or English body text.';
    case 'en':
      return 'ANSWER_LANG=en (AUTHORITATIVE) — PHẦN 1 + PHẦN 2 MUST be English only from CBETA Hán. FORBIDDEN: Vietnamese body text. Key Hán terms may appear in parentheses.';
    default:
      return 'ANSWER_LANG=vi (AUTHORITATIVE) — PHẦN 1 + PHẦN 2 MUST be Vietnamese. FORBIDDEN: answering in English or Chinese prose. Hán terms only as short parentheses glosses.';
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
