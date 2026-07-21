export interface PassageHit {
  passageId: string;
  content: string;
  pageNum: number | null;
  chunkType: string;
  title: string;
  volume: string | null;
  sourceFile: string;
  score: number;
}

/** Link mở kinh sách PDF — dùng cho tab Kinh sách / nút "Mở tr.360" */
export interface PdfOpenLink {
  pdfFileId: string;
  pdfTitle: string;
  pdfSlug: string;
  pdfUrl: string;
  pageNum: number | null;
  openLabel: string;
  apiPath: string;
}

export interface ChatCitation {
  passageId: string;
  label: string;
  title: string;
  volume: string | null;
  /** Primary printed page (hit page). */
  pageNum: number | null;
  /** First printed page in the neighbor window (if any). */
  pageStart: number | null;
  /** Last printed page in the neighbor window (if any). */
  pageEnd: number | null;
  /**
   * All printed pages in this one citation (e.g. 16,17,18).
   * UI shows one card; each page chip opens that page.
   */
  pages?: number[];
  sourceFile: string;
  score: number;
  /** Đoạn trích liên quan câu hỏi — hiển thị bắt buộc cho user tự đối chiếu */
  quote: string;
  excerpt: string;
  /** Nút mở PDF đúng trang (null nếu chưa có PDF trong hệ thống) */
  pdf: PdfOpenLink | null;
  openLabel: string | null;
  /** Per-page open targets for chips inside one citation card. */
  pageLinks?: Array<{
    printed: number;
    filePage: number;
    openLabel: string;
  }>;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  topK?: number;
  /** Hard book filter (source_file values). Empty/omit = entire corpus. */
  sourceFiles?: string[];
  /** Prior conversation turns (not including the current question). */
  messages?: ChatTurn[];
}

export interface ChatMeta {
  topK: number;
  topKResolved: number;
  embeddingCount: number;
  searchMode: 'hybrid' | 'vector' | 'fts';
  /** Wall-clock ms for retrieval (DB + embed + rank) */
  retrievalMs?: number;
  /** Wall-clock ms for LLM answer generation */
  llmMs?: number;
  /** Total request ms */
  totalMs?: number;
  /** Set when hybrid embed step failed and fell back to FTS */
  embedError?: string | null;
  /** kinh_long | mixed | brief */
  answerStyle?: 'kinh_long' | 'mixed' | 'brief';
  /** shopaikey | nexus | hhtech | flare */
  chatProvider?: 'shopaikey' | 'nexus' | 'hhtech' | 'flare';
  /** Applied hard book filter (normalized source_file list). */
  sourceFiles?: string[];
  /** Number of prior turns sent to the LLM. */
  historyTurns?: number;
}

export interface ChatResult {
  answer: string;
  /** AI commentary — separate from scripture quotes; show last in UI. */
  aiInterpretation: string | null;
  disclaimer: string;
  citations: ChatCitation[];
  meta: ChatMeta;
}

/** SSE payload shapes for POST /rag/chat/stream */
export type ChatStreamEvent =
  | { type: 'status'; phase: 'retrieving' | 'generating' | 'finalizing' }
  | { type: 'delta'; text: string }
  | {
      type: 'done';
      answer: string;
      aiInterpretation: string | null;
      disclaimer: string;
      citations: ChatCitation[];
      meta: ChatMeta;
    }
  | { type: 'error'; message: string };
