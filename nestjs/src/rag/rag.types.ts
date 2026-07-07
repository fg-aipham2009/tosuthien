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
  pageNum: number | null;
  sourceFile: string;
  score: number;
  /** Đoạn trích liên quan câu hỏi — hiển thị bắt buộc cho user tự đối chiếu */
  quote: string;
  excerpt: string;
  /** Nút mở PDF đúng trang (null nếu chưa có PDF trong hệ thống) */
  pdf: PdfOpenLink | null;
  openLabel: string | null;
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
  /** shopaikey | nexus */
  chatProvider?: 'shopaikey' | 'nexus' | 'hhtech';
}

export interface ChatResult {
  answer: string;
  disclaimer: string;
  citations: ChatCitation[];
  meta: ChatMeta;
}
