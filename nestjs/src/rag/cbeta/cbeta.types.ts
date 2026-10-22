export type CbetaCorpus = 'books' | 'cbeta' | 'auto';
export type CbetaPath = 'fast' | 'deep';

export interface CbetaRouteDecision {
  /** Requested corpus (after normalize). */
  corpus: CbetaCorpus;
  /** Where the query will actually run. */
  resolvedCorpus: 'books' | 'cbeta';
  path: CbetaPath;
  collections: string[];
  workCodes: string[];
  /** Hard juan filter from parsed question (卷N / quyển N). */
  juanNo: number | null;
  /** Hard linehead/page needle for cbeta_ref_start (e.g. p0292). */
  cbetaRefNeedle: string | null;
  /**
   * True only when the question matches coverage/enumerate intent.
   * Deep retrieve then seeds from CBETA_COVERAGE_TITLE_REGEX / DEEP_MAX_WORKS.
   */
  coverageMode: boolean;
  /**
   * True for heading-scoped register lists (e.g. 馬祖法嗣 五十六人).
   * Uses section retrieve + ordered parse — not global 西天/東土 coverage.
   */
  sectionListMode: boolean;
  /**
   * True for named 五家 school succession (曹洞/臨濟/…).
   * Hybrid retrieve + evidence-first LLM — not coverage entity dump.
   */
  schoolLineageMode: boolean;
  /**
   * True for Dharma successors / 法嗣 of one focal person.
   * Locator/phrase retrieve + scoped list — not document-wide coverage.
   */
  personRelationMode: boolean;
  /**
   * True when verifying whether a quotation / teaching appears in CBETA.
   * Phrase-first retrieve — not coverage dump.
   */
  quoteVerifyMode: boolean;
  /**
   * True for scripture explanation / gloss / doctrinal “does X mean Y?” questions.
   * Phrase-aware retrieve + grounding brief — not coverage dump.
   */
  scriptureExplainMode: boolean;
  /** Factual route summary (path + filters). Actual scan list comes from retrieve. */
  scopeNote: string;
  reasons: string[];
}

export interface CbetaChunkHit {
  id: string;
  workCode: string;
  collection: string;
  titleZh: string;
  juanNo: number | null;
  juanLabel: string | null;
  chunkIndex: number;
  contentZh: string;
  score: number;
  cbetaRefStart: string | null;
}

export interface CbetaCitation {
  chunkId: string;
  workCode: string;
  collection: string;
  titleZh: string;
  juanNo: number | null;
  juanLabel: string | null;
  chunkIndex: number;
  label: string;
  quote: string;
  score: number;
  cbetaRefStart: string | null;
  /** CBETA Online reader URL (no internal chunk id in label). */
  url: string | null;
}

export interface CbetaEntityHit {
  nameZh: string;
  count: number;
  works: string[];
}

export interface CbetaDeepProgress {
  pass: number;
  totalPasses: number;
  workCode: string;
  titleZh: string;
  entityCount: number;
}

export interface CbetaRetrieveResult {
  hits: CbetaChunkHit[];
  searchMode: 'hybrid' | 'vector' | 'fts' | 'deep';
  embedError: string | null;
  entities?: CbetaEntityHit[];
  worksScanned?: string[];
  passes?: number;
}

/** VN/other → Hán search rewrite (hhtech) before CBETA retrieve. */
export interface CbetaQueryRewrite {
  /** Text used for embed + FTS. */
  searchZh: string;
  keywords: string[];
  /** True when rewrite skipped (already CJK / disabled / failed). */
  skipped: boolean;
  reason?: string;
  rewriteMs?: number;
}
