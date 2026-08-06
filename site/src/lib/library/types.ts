export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  citations?: ChatCitation[];
  aiInterpretation?: string | null;
  disclaimer?: string | null;
  streaming?: boolean;
};

export type ChatCitationPageLink = {
  printed: number;
  filePage: number;
  openLabel: string;
};

export type ChatCitation = {
  passageId?: string;
  label?: string;
  title?: string;
  volume?: string | null;
  pageNum?: number | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  pages?: number[];
  sourceFile?: string;
  score?: number;
  quote?: string;
  excerpt?: string;
  openLabel?: string | null;
  pdf?: {
    pdfFileId?: string;
    pdfTitle?: string;
    pdfSlug?: string;
    pdfUrl?: string;
    pageNum?: number | null;
    openLabel?: string;
    apiPath?: string;
  } | null;
  pageLinks?: ChatCitationPageLink[];
};

export type RagSource = {
  id: string;
  title: string;
  sourceFile: string;
  sortOrder?: number;
};

export type BookPdf = {
  id: string;
  slug: string;
  title: string;
  author?: string | null;
  filename?: string;
  publicUrl: string;
  storagePath?: string;
  pageCount?: number | null;
  coverImageUrl?: string | null;
  lastPage?: number | null;
  sortOrder?: number;
};

export type TextBook = {
  id: string;
  title: string;
  author?: string | null;
  pageCount?: number;
  blankPages?: number;
  coverImageUrl?: string | null;
  lastPage?: number | null;
  pdfFileId?: string | null;
  sortOrder?: number;
};

export type TextBookPage = {
  page: number;
  text: string;
  isBlank?: boolean;
};

export type MediaCategory = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  sortOrder: number;
};

export type Mp3Track = {
  id: string;
  title: string;
  year?: number | null;
  folderPath?: string;
  filename: string;
  publicUrl: string;
  durationSec?: number | null;
  categoryId?: string;
};
