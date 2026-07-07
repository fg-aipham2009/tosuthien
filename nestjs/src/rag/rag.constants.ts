export const DEFAULT_TOP_K = 5;
export const LOOKUP_TOP_K = 3;
export const DEFINITION_TOP_K = 8;
export const COMPARISON_TOP_K = 8;
export const MAX_TOP_K = 10;
/** Số ứng viên lấy về để lọc/xếp hạng trước khi cắt còn topK (recall > precision ở bước này) */
export const CANDIDATE_POOL = 30;

export const RAG_DISCLAIMER =
  'Câu trả lời do AI tổng hợp từ kinh sách. Vui lòng đọc lại đoạn trích bên dưới và mở đúng trang PDF để tự kiểm chứng — không nên tin hoàn toàn vào AI.';

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
