import { listPdfs } from '../api/books'
import type { ChatCitation, ChatCitationPageLink } from '../types'

export function scriptureOnly(content: string): string {
  const marker = '【AI diễn giải】'
  const idx = content.indexOf(marker)
  if (idx < 0) return content.trim()
  return content.slice(0, idx).trim()
}

export function citationBody(c: ChatCitation): string {
  return (c.excerpt || c.quote || '').trim()
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
    filePage: printed,
    openLabel: `tr.${printed}`,
  }))
}

export function defaultFilePage(c: ChatCitation): number {
  return (
    c.pdf?.pageNum ??
    tappablePages(c)[0]?.filePage ??
    c.pageNum ??
    c.pageStart ??
    1
  )
}

export function sourceStem(sourceFile?: string | null): string | null {
  if (!sourceFile?.trim()) return null
  return sourceFile.trim().replace(/\.(txt|pdf)$/i, '')
}

/** Resolve PDF id for in-app reader (Flutter parity). */
export async function resolveCitationPdfId(c: ChatCitation): Promise<string | null> {
  if (c.pdf?.pdfFileId) return c.pdf.pdfFileId
  const stem = sourceStem(c.sourceFile)
  if (!stem) return null
  const pdfs = await listPdfs()
  const hit = pdfs.find((b) => {
    const fileStem = b.filename?.replace(/\.pdf$/i, '')
    return fileStem === stem || b.slug === stem || b.id === stem
  })
  return hit?.id ?? null
}
