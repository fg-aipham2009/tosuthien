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
  /tóm\s*gọn|tóm\s*lược|tóm\s*tắt|ngắn\s*gọn|nói\s*ngắn|vài\s*câu|yếu\s*chỉ|đại\s*ý|cốt\s*lõi|cương\s*yếu/i;

export function isCbetaBriefQuestion(question: string): boolean {
  return CBETA_BRIEF_RE.test((question || '').trim());
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
