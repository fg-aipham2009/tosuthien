/**
 * Structured CBETA RAG diagnostics (debug-gated via CBETA_DIAG=1).
 * Never log secrets; truncate large text fields.
 */

import type { CbetaChunkHit, CbetaRouteDecision } from './cbeta.types';

export interface CbetaDiagTrace {
  request_id: string;
  query: string;
  normalized_query: string;
  detected_intent: string;
  selected_route: string;
  extracted_entities: string[];
  document_constraints: string[];
  retrieval_queries: string[];
  retrieved_chunks: Array<{
    id: string;
    workCode: string;
    juanNo: number | null;
    cbetaRefStart: string | null;
    score: number;
    rank: number;
  }>;
  reranked_chunks: Array<{
    id: string;
    workCode: string;
    score: number;
    rank: number;
  }>;
  selected_evidence: Array<{
    id: string;
    workCode: string;
    cbetaRefStart: string | null;
  }>;
  context_token_count: number;
  cache_hit: boolean;
  cache_key: string;
  generation_route: string;
  cited_evidence_ids: string[];
  validation_errors: string[];
}

export function cbetaDiagEnabled(): boolean {
  const v = (
    process.env.CBETA_DIAG ||
    process.env.CBETA_DEBUG ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

function trunc(s: string, n = 240): string {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

export function detectIntentLabel(decision: CbetaRouteDecision): string {
  if (decision.sectionListMode) return 'section_list';
  if (decision.schoolLineageMode) return 'school_lineage';
  if (decision.personRelationMode) return 'person_relation';
  if (decision.quoteVerifyMode) return 'quote_verify';
  if (decision.scriptureExplainMode) return 'scripture_explain';
  if (decision.coverageMode) return 'document_enumeration';
  if (decision.cbetaRefNeedle) return 'locator';
  return 'general';
}

export function buildCbetaDiagTrace(input: {
  requestId: string;
  query: string;
  searchZh: string;
  decision: CbetaRouteDecision;
  entities: string[];
  retrievalQueries: string[];
  retrieved: CbetaChunkHit[];
  selected: CbetaChunkHit[];
  contextChars: number;
  cacheHit: boolean;
  cacheKey: string;
  generationRoute: string;
  citedIds: string[];
  validationErrors: string[];
}): CbetaDiagTrace {
  const { decision } = input;
  return {
    request_id: input.requestId,
    query: trunc(input.query, 500),
    normalized_query: trunc(input.searchZh, 500),
    detected_intent: detectIntentLabel(decision),
    selected_route: decision.scopeNote,
    extracted_entities: input.entities.map((e) => trunc(e, 80)),
    document_constraints: [
      ...decision.workCodes.map((w) => `work:${w}`),
      decision.juanNo != null ? `juan:${decision.juanNo}` : null,
      decision.cbetaRefNeedle ? `ref:${decision.cbetaRefNeedle}` : null,
      ...decision.collections.map((c) => `collection:${c}`),
    ].filter((x): x is string => !!x),
    retrieval_queries: input.retrievalQueries.map((q) => trunc(q, 200)),
    retrieved_chunks: input.retrieved.map((h, i) => ({
      id: h.id,
      workCode: h.workCode,
      juanNo: h.juanNo,
      cbetaRefStart: h.cbetaRefStart,
      score: h.score,
      rank: i + 1,
    })),
    reranked_chunks: input.retrieved.map((h, i) => ({
      id: h.id,
      workCode: h.workCode,
      score: h.score,
      rank: i + 1,
    })),
    selected_evidence: input.selected.map((h) => ({
      id: h.id,
      workCode: h.workCode,
      cbetaRefStart: h.cbetaRefStart,
    })),
    context_token_count: Math.ceil(input.contextChars / 2),
    cache_hit: input.cacheHit,
    cache_key: trunc(input.cacheKey, 120),
    generation_route: input.generationRoute,
    cited_evidence_ids: input.citedIds,
    validation_errors: input.validationErrors,
  };
}
