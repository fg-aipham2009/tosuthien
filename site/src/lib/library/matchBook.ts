import type { BookPdf, TextBook } from "./types";

/** Chuẩn hóa tiêu đề để khớp danh mục Giới thiệu ↔ API. */
export function normalizeBookTitle(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function scoreMatch(query: string, candidate: string): number {
  const q = normalizeBookTitle(query);
  const c = normalizeBookTitle(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.includes(q) || q.includes(c)) return 80;
  const qTokens = q.split(" ").filter((t) => t.length > 2);
  if (!qTokens.length) return 0;
  const hit = qTokens.filter((t) => c.includes(t)).length;
  return (hit / qTokens.length) * 60;
}

export type MatchedBookIds = {
  pdfId: string | null;
  textId: string | null;
};

/** Ghép tiêu đề mục Giới thiệu với PDF / sách chữ trong thư viện. */
export function matchBookIds(
  title: string,
  pdfs: BookPdf[],
  texts: TextBook[],
): MatchedBookIds {
  let bestPdf: { id: string; score: number } | null = null;
  let bestText: { id: string; score: number } | null = null;

  for (const p of pdfs) {
    const s = scoreMatch(title, p.title);
    if (s >= 45 && (!bestPdf || s > bestPdf.score)) {
      bestPdf = { id: p.id, score: s };
    }
  }
  for (const t of texts) {
    const s = scoreMatch(title, t.title);
    if (s >= 45 && (!bestText || s > bestText.score)) {
      bestText = { id: t.id, score: s };
    }
  }

  return {
    pdfId: bestPdf?.id ?? null,
    textId: bestText?.id ?? null,
  };
}
