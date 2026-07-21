export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
  citations?: ChatCitation[]
  /** Separate AI commentary — show below citations. */
  aiInterpretation?: string | null
  disclaimer?: string | null
  streaming?: boolean
}

export interface ChatCitationPageLink {
  printed: number
  filePage: number
  openLabel: string
}

export interface ChatCitation {
  passageId?: string
  label?: string
  title?: string
  volume?: string | null
  pageNum?: number | null
  pageStart?: number | null
  pageEnd?: number | null
  pages?: number[]
  sourceFile?: string
  score?: number
  quote?: string
  excerpt?: string
  openLabel?: string | null
  pdf?: {
    pdfFileId?: string
    pdfTitle?: string
    pdfSlug?: string
    pdfUrl?: string
    pageNum?: number | null
    openLabel?: string
    apiPath?: string
  } | null
  pageLinks?: ChatCitationPageLink[]
}

export interface RagSource {
  id: string
  title: string
  sourceFile: string
  sortOrder?: number
}

export interface BookPdf {
  id: string
  slug: string
  title: string
  author?: string | null
  filename?: string
  publicUrl: string
  storagePath?: string
  pageCount?: number | null
  coverImageUrl?: string | null
  lastPage?: number | null
  sortOrder?: number
}

export interface TextBook {
  id: string
  title: string
  author?: string | null
  pageCount?: number
  /** Leading blank/front-matter pages to skip when opening. */
  blankPages?: number
  coverImageUrl?: string | null
  lastPage?: number | null
  sortOrder?: number
}

export interface TextBookPage {
  page: number
  text: string
  isBlank?: boolean
}

export interface MediaCategory {
  id: string
  slug: string
  name: string
  description?: string | null
  sortOrder: number
}

export interface Mp3Track {
  id: string
  title: string
  year?: number | null
  folderPath?: string
  filename: string
  publicUrl: string
  durationSec?: number | null
  categoryId?: string
}

export type CenterRegion = 'NAM' | 'TRUNG' | 'BAC' | 'NUOC_NGOAI'

export interface Center {
  id: string
  slug: string
  templeName: string
  abbotName?: string | null
  abbotRank?: string | null
  abbotTitle?: string | null
  region: CenterRegion
  province?: string | null
  address?: string | null
  phone?: string | null
  googleMapsUrl?: string | null
  mainImageUrl?: string | null
  activityHours?: string | null
  rules?: string | null
  customs?: string | null
  detailContent?: string | null
  courses?: CenterCourse[]
}

export interface CenterCourse {
  id: string
  title?: string | null
  type?: string | null
  recurrence?: string | null
  startDate?: string | null
  endDate?: string | null
  dayStart?: number | null
  dayEnd?: number | null
  weekday?: number | null
  scheduleText?: string | null
  description?: string | null
  contact?: string | null
  sortOrder?: number
  /** Legacy admin field; prefer scheduleText / day range. */
  scheduleNote?: string | null
}
