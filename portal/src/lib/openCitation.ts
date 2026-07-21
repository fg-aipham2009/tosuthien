import { listPdfs } from '../api/books'
import { API_ORIGIN } from '../config'
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

function citationGroupKey(c: ChatCitation): string {
  const file = (c.sourceFile || '').trim().toLowerCase()
  if (file) return `file:${file.replace(/\.(txt|pdf)$/i, '')}`
  const title = (c.title || c.label || 'unknown')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `title:${title || 'unknown'}`
}

/**
 * One card per book: merge all cited pages into chips (tr.4 · tr.5 · tr.7).
 * Defensive for older API payloads / localStorage history.
 */
export function mergeCitationsByBook(citations: ChatCitation[]): ChatCitation[] {
  if (citations.length <= 1) return citations

  const groups = new Map<string, ChatCitation[]>()
  const order: string[] = []
  for (const c of citations) {
    const key = citationGroupKey(c)
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(c)
  }

  return order.map((key) => {
    const group = groups.get(key)!
    const pageSet = new Set<number>()
    for (const c of group) {
      if (c.pageNum != null) pageSet.add(c.pageNum)
      for (const link of c.pageLinks ?? []) pageSet.add(link.printed)
      for (const p of c.pages ?? []) pageSet.add(p)
      if (
        c.pageStart != null &&
        c.pageEnd != null &&
        c.pageEnd >= c.pageStart &&
        c.pageEnd - c.pageStart <= 8
      ) {
        for (let p = c.pageStart; p <= c.pageEnd; p++) pageSet.add(p)
      }
    }
    const pages = [...pageSet].sort((a, b) => a - b)
    const primary = [...group].sort(
      (a, b) => Number(b.score ?? 0) - Number(a.score ?? 0),
    )[0]
    const pageStart = pages[0] ?? primary.pageStart ?? primary.pageNum ?? null
    const pageEnd =
      pages[pages.length - 1] ?? primary.pageEnd ?? primary.pageNum ?? null
    const pageLinks = pages.map((printed) => ({
      printed,
      filePage: toPdfFilePage(primary.sourceFile, printed),
      openLabel: `tr.${printed}`,
    }))
    const excerpt =
      group
        .map((c) => (c.excerpt || c.quote || '').trim())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0] || primary.excerpt
    const quote =
      group.map((c) => c.quote?.trim()).find((q) => !!q) || primary.quote

    return {
      ...primary,
      pages,
      pageNum: primary.pageNum ?? pageStart,
      pageStart,
      pageEnd,
      pageLinks,
      excerpt,
      quote,
    }
  })
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

function stripHash(url: string): string {
  const i = url.indexOf('#')
  return i >= 0 ? url.slice(0, i) : url
}

/** Direct API file URL, e.g. https://api.tosuthien.net/files/pdf/21.pdf#page=4 */
export async function resolveCitationPdfFileUrl(
  c: ChatCitation,
  filePage?: number,
): Promise<string | null> {
  const page = filePage ?? defaultFilePage(c)
  const fromApi = c.pdf?.pdfUrl?.trim()
  if (fromApi) {
    return `${stripHash(fromApi)}#page=${page}`
  }

  const stem = sourceStem(c.sourceFile)
  if (stem) {
    return `${API_ORIGIN}/files/pdf/${stem}.pdf#page=${page}`
  }

  const id = c.pdf?.pdfFileId
  if (id) {
    const pdfs = await listPdfs()
    const hit = pdfs.find((b) => b.id === id)
    if (hit?.publicUrl) return `${stripHash(hit.publicUrl)}#page=${page}`
    if (hit?.filename) {
      return `${API_ORIGIN}/files/pdf/${hit.filename.replace(/^pdf\//, '')}#page=${page}`
    }
  }
  return null
}
