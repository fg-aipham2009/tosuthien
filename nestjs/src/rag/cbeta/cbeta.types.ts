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
  /** Human-readable scope note for prompts / UI. */
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
