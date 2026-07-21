import { listPdfs } from '../api/books'
import type { ChatCitation, ChatCitationPageLink } from '../types'

/** Keep in sync with nestjs/src/rag/rag-source.util.ts PDF_FILE_PAGE_OFFSET_BY_STEM */
const PDF_FILE_PAGE_OFFSET_BY_STEM: Record<string, number> = {
  '1': 2,
  '2': 2,
  '5': 2,
  '9': 2,
  '10': 2,
  '11': 2,
  '13': -2,
  '14': -2,
  '15': 2,
  '17': 3,
  '18': 3,
  '22': 2,
}

export function scriptureOnly(content: string): string {
  const marker = '【AI diễn giải】'
  const idx = content.indexOf(marker)
  if (idx < 0) return content.trim()
  return content.slice(0, idx).trim()
}

export function citationBody(c: ChatCitation): string {
  return (c.excerpt || c.quote || '').trim()
}

export function sourceStem(sourceFile?: string | null): string | null {
  if (!sourceFile?.trim()) return null
  return sourceFile.trim().replace(/\.(txt|pdf)$/i, '').toLowerCase()
}

export function toPdfFilePage(sourceFile: string | null | undefined, printed: number): number {
  const stem = sourceStem(sourceFile) ?? ''
  const offset = PDF_FILE_PAGE_OFFSET_BY_STEM[stem] ?? 0
  return Math.max(1, printed - offset)
}

export function tappablePages(c: ChatCitation): ChatCitationPageLink[] {
  if (c.pageLinks?.length) return c.pageLinks
  const pages =
    c.pages?.length
      ? c.pages
      : c.pageStart != null && c.pageEnd != null && c.pageEnd >= c.pageStart
        ? Array.from({ length: c.pageEnd - c.pageStart + 1 }, (_, i) => c.pageStart! + i)
        : c.pageNum != null
          ? [c.pageNum]
          : []
  return pages.map((printed) => ({
    printed,
    filePage: toPdfFilePage(c.sourceFile, printed),
    openLabel: `tr.${printed}`,
  }))
}

export function defaultFilePage(c: ChatCitation): number {
  return (
    c.pdf?.pageNum ??
    tappablePages(c)[0]?.filePage ??
    (c.pageNum != null ? toPdfFilePage(c.sourceFile, c.pageNum) : 1)
  )
}

/** Resolve PDF id for in-app reader (Flutter parity). */
export async function resolveCitationPdfId(c: ChatCitation): Promise<string | null> {
  if (c.pdf?.pdfFileId) return c.pdf.pdfFileId
  const stem = sourceStem(c.sourceFile)
  if (!stem) return null
  const pdfs = await listPdfs()
  const hit = pdfs.find((b) => {
    const fileStem = b.filename?.replace(/\.pdf$/i, '')?.toLowerCase()
    return fileStem === stem || b.slug === stem || b.id === stem
  })
  return hit?.id ?? null
}
