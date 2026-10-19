/**
 * CBETA neighbor expand helpers (A/B Test 1–2):
 * - Asymmetric window [-1, +2] for top anchor hits
 * - Overlap stitch when concatenating adjacent chunks
 * - Dialogue-aware backshift when the window opens mid-answer
 */

/** Top hits that get the wide asymmetric window (user A/B Test 1). */
export const CBETA_ANCHOR_EXPAND_HITS = 2;

/** CBETA / Classical Chinese: dialogue / narrative openers. */
const CBETA_QUESTION_OPEN =
  /問[：:]|僧問|師問|問曰|爾時|佛告|時有僧|乃問|因問/;

/** CBETA: answer / teaching openers (hit landed on 答 without 問). */
const CBETA_ANSWER_OPEN =
  /^(?:[\s　]*)(?:師云|師曰|師言|師云曰|佛言|佛告|答曰|答云|良久|喝[：:]|曰[：:])/;

/** Vietnamese Tổ Sư Thiền OCR markers. */
const VN_QUESTION_OPEN = /(?:^|\n)\s*(?:\*{0,2}\d*\.?\s*)?(?:HỎI|Hỏi|Khách hỏi)\s*[:：]/m;
const VN_ANSWER_OPEN =
  /(?:^|\n)\s*[➤➢]?\s*(?:\*{0,2})?(?:ĐÁP|Đáp|Sư bảo|Sư dạy)\s*[:：]/m;

export type CbetaExpandRole = 'anchor' | 'support';

/** Index range for one hit before dialogue backshift. */
export function cbetaExpandIndexRange(
  chunkIndex: number,
  role: CbetaExpandRole,
): { from: number; to: number } {
  const i = Math.max(0, chunkIndex);
  if (role === 'anchor') {
    // Asymmetric: prior context + longer teaching tail (Test 1).
    return { from: Math.max(0, i - 1), to: i + 2 };
  }
  // Support hits: light forward bias [0, +1] relative to center.
  return { from: i, to: i + 1 };
}

/**
 * True when the first chunk of a window looks like an answer/teaching
 * without a preceding question/occasion opener (Test 2).
 */
export function needsCbetaDialogueBackshift(firstChunkZh: string): boolean {
  const head = (firstChunkZh || '').trim().slice(0, 160);
  if (!head) return false;
  if (CBETA_QUESTION_OPEN.test(head)) return false;
  return CBETA_ANSWER_OPEN.test(head) || /^曰[：:]/.test(head);
}

export function needsVnDialogueBackshift(firstPageText: string): boolean {
  const head = (firstPageText || '').trim().slice(0, 400);
  if (!head) return false;
  if (VN_QUESTION_OPEN.test(head)) return false;
  return VN_ANSWER_OPEN.test(head);
}

/**
 * Concatenate ordered chunk texts and strip repeated overlap at boundaries
 * (ingest overlap prefix would otherwise appear twice for Claude).
 */
export function stitchChunkTexts(parts: string[]): string {
  const cleaned = parts.map((p) => (p || '').trim()).filter(Boolean);
  if (!cleaned.length) return '';
  let out = cleaned[0];
  for (let i = 1; i < cleaned.length; i++) {
    out = appendWithoutOverlap(out, cleaned[i]);
  }
  return out;
}

function appendWithoutOverlap(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  // Prefer longer overlap; floor 2 so short CJK tails (e.g. 師曰…) still dedupe.
  const max = Math.min(left.length, right.length, 400);
  for (let n = max; n >= 2; n--) {
    if (left.endsWith(right.slice(0, n))) {
      return left + right.slice(n);
    }
  }
  // No meaningful overlap — join with a single newline for readability.
  const gap =
    left.endsWith('\n') || right.startsWith('\n') ? '' : '\n';
  return left + gap + right;
}
