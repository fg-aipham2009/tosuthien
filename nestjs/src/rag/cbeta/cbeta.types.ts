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
  /**
   * Optional quote/passage locator metadata (CBETA_QUOTE_LEVEL_CITATIONS).
   * Omitted when flag off or mapping unavailable — never fabricated.
   */
  chunkStartLocator?: string | null;
  chunkEndLocator?: string | null;
  quoteStartLocator?: string | null;
  quoteEndLocator?: string | null;
  locatorPrecision?: 'passage' | 'quote_approx' | 'unavailable';
  evidenceId?: string;
  workId?: string;
  juan?: number | null;
}

/** Per-work outcome when multi-work retrieval is enabled. */
export type CbetaWorkDiagStatus =
  | 'ok'
  | 'work_not_indexed'
  | 'no_matching_passage'
  | 'filtered_by_ranking'
  | 'removed_by_context_budget';

export interface CbetaWorkDiagnostic {
  workCode: string;
  status: CbetaWorkDiagStatus;
  hitCount: number;
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
  /** Present when CBETA_MULTI_WORK_RETRIEVAL ran independent per-work queries. */
  workDiagnostics?: CbetaWorkDiagnostic[];
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
