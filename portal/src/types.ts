export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
  citations?: ChatCitation[]
  streaming?: boolean
}

export interface ChatCitation {
  title?: string
  pageNum?: number
  sourceFile?: string
  quote?: string
  excerpt?: string
  openLabel?: string
  pdf?: {
    pdfUrl?: string
    pageNum?: number
    openLabel?: string
  }
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
  type?: string
  description?: string | null
  scheduleNote?: string | null
}
