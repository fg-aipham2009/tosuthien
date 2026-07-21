export const DEFAULT_TOP_K = 14;
export const LOOKUP_TOP_K = 10;
export const DEFINITION_TOP_K = 16;
export const COMPARISON_TOP_K = 16;
export const MAX_TOP_K = 22;
/** Candidate pool before filtering/ranking (recall > precision here). */
export const CANDIDATE_POOL = 72;

export const RAG_DISCLAIMER =
  'Nguyên văn = lời kinh sách (không chỉnh sửa). 「AI diễn giải」 lấy nền từ câu hỏi + nguyên văn; có thể bổ sung kiến thức nền — không phải kinh văn. Hãy đối chiếu thẻ nguồn và PDF.';

/** Exact heading the model must use before any AI commentary. */
export const AI_INTERPRETATION_MARKER = '【AI diễn giải】';

const COMPARISON_PATTERN =
  /\b(so sánh|khác nhau|khác gì|phân biệt|đối chiếu|vs|với)\b/i;

const DEFINITION_PATTERN =
  /(?:là gì|là sao|nghĩa là|nghĩa của|thế nào là)/i;

export function resolveTopK(question: string, keywordCount: number): number {
  if (COMPARISON_PATTERN.test(question)) return Math.min(COMPARISON_TOP_K, MAX_TOP_K);
  if (DEFINITION_PATTERN.test(question)) return Math.min(DEFINITION_TOP_K, MAX_TOP_K);
  if (keywordCount <= 2) return LOOKUP_TOP_K;
  return DEFAULT_TOP_K;
}
export function clampTopK(
  topK: number | undefined,
  question: string,
  keywordCount: number,
): number {
  const resolved = topK ?? resolveTopK(question, keywordCount);
  return Math.min(Math.max(resolved, 1), MAX_TOP_K);
}
