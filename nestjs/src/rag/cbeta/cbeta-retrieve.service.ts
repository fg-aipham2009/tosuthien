import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from '../embedding.service';
import { CANDIDATE_POOL, LOOKUP_TOP_K } from '../rag.constants';
import { CbetaDbService } from './cbeta-db.service';
import { CbetaEntitiesService } from './cbeta-entities.service';
import { lexicalOverlapScore } from './cbeta-entity.util';
import { buildCbetaOnlineUrl } from './cbeta-link.util';
import {
  buildOrTsQuery,
  extractLexicalTerms,
  parseNgramSizes,
} from './cbeta-lexical.util';
import type {
  CbetaChunkHit,
  CbetaDeepProgress,
  CbetaEntityHit,
  CbetaRetrieveResult,
  CbetaRouteDecision,
} from './cbeta.types';

/** Classic RRF rank constant (Cormack et al.). */
const RRF_K = 60;

export interface CbetaRetrieveOptions {
  /** Extra terms from VN→Hán rewrite keywords (for FTS OR / ILIKE). */
  lexicalKeywords?: string[];
}

@Injectable()
export class CbetaRetrieveService {
  private readonly logger = new Logger(CbetaRetrieveService.name);

  constructor(
    private readonly db: CbetaDbService,
    private readonly embedding: EmbeddingService,
    private readonly config: ConfigService,
    private readonly entities: CbetaEntitiesService,
  ) {}

  /**
   * Optional Postgres regex for coverage seed titles (env CBETA_COVERAGE_TITLE_REGEX).
   * When unset, coverage lists works by size/filter only — no invented title subset.
   */
  private coverageTitleRegex(): string | null {
    const re = (this.config.get<string>('CBETA_COVERAGE_TITLE_REGEX') || '').trim();
    return re || null;
  }

  private candidatePool(): number {
    const n = parseInt(
      this.config.get<string>('CBETA_CANDIDATE_POOL') || '',
      10,
    );
    return Number.isFinite(n) && n > 0 ? n : CANDIDATE_POOL;
  }

  private contextCharBudget(): number {
    const n = parseInt(
      this.config.get<string>('CBETA_MAX_CONTEXT_CHARS') || '',
      10,
    );
    // Fallback aligns with book RAG soft context room when env unset.
    return Number.isFinite(n) && n > 0 ? n : 100_000;
  }

  async retrieve(
    question: string,
    decision: CbetaRouteDecision,
    topK?: number,
    options?: CbetaRetrieveOptions,
  ): Promise<CbetaRetrieveResult> {
    // Multi-pass lamp/denglu scan only for real coverage/enumerate intent.
    // forcePath=deep without coverageMode must not invent that subset.
    if (decision.path === 'deep' && decision.coverageMode) {
      return this.retrieveDeep(question, decision, topK, undefined, options);
    }
    return this.retrieveFast(question, decision, topK, options);
  }

  private lexicalTerms(
    question: string,
    options?: CbetaRetrieveOptions,
  ): string[] {
    const ngrams = parseNgramSizes(
      this.config.get<string>('CBETA_LEXICAL_NGRAMS') ||
        process.env.CBETA_LEXICAL_NGRAMS,
    );
    return extractLexicalTerms(question, options?.lexicalKeywords || [], ngrams);
  }

  async retrieveFast(
    question: string,
    decision: CbetaRouteDecision,
    topK?: number,
    options?: CbetaRetrieveOptions,
  ): Promise<CbetaRetrieveResult> {
    const pool = this.candidatePool();
    const k = Math.max(1, topK ?? pool);
    const filter = this.filterSql({ ...decision, path: 'fast' });
    const terms = this.lexicalTerms(question, options);

    let embedError: string | null = null;
    let vectorHits: CbetaChunkHit[] = [];
    try {
      const vec = await this.embedding.embed(question);
      vectorHits = await this.searchVector(vec, pool, filter);
    } catch (err: unknown) {
      embedError = err instanceof Error ? err.message : String(err);
      this.logger.warn(`CBETA embed failed: ${embedError}`);
    }

    let ftsHits = await this.searchFts(question, terms, pool, filter, 'fast');
    if (!ftsHits.length && terms.length) {
      ftsHits = await this.searchLexical(terms, pool, filter);
    }

    let hits: CbetaChunkHit[];
    let searchMode: 'hybrid' | 'vector' | 'fts';
    if (vectorHits.length && ftsHits.length) {
      hits = this.fuseRrf(vectorHits, ftsHits);
      searchMode = 'hybrid';
    } else if (vectorHits.length) {
      hits = vectorHits;
      searchMode = 'vector';
    } else {
      hits = ftsHits;
      searchMode = 'fts';
    }

    const rerankQ = [question, ...terms].join(' ');
    hits = this.rerank(rerankQ, hits).slice(0, k);
    hits = await this.expandNeighbors(hits);
    return { hits, searchMode, embedError };
  }

  /**
   * Coverage multi-pass: scan works whose titles match lamp/denglu patterns
   * (only when decision.coverageMode), extract entities, then hybrid+rerank.
   */
  async retrieveDeep(
    question: string,
    decision: CbetaRouteDecision,
    topK?: number,
    onProgress?: (p: CbetaDeepProgress) => void,
    options?: CbetaRetrieveOptions,
  ): Promise<CbetaRetrieveResult> {
    if (!decision.coverageMode) {
      return this.retrieveFast(question, decision, topK, options);
    }
    const maxWorksEnv = parseInt(
      this.config.get<string>('CBETA_DEEP_MAX_WORKS') || '',
      10,
    );
    const hasMaxWorks = Number.isFinite(maxWorksEnv) && maxWorksEnv > 0;
    if (!this.coverageTitleRegex() && !hasMaxWorks) {
      this.logger.warn(
        'coverageMode needs CBETA_COVERAGE_TITLE_REGEX and/or CBETA_DEEP_MAX_WORKS; falling back to hybrid',
      );
      return this.retrieveFast(question, decision, topK);
    }
    const works = await this.listCoverageWorks(decision.collections);
    const workList = hasMaxWorks ? works.slice(0, maxWorksEnv) : works;

    const acc = new Map<string, { count: number; works: Set<string> }>();
    const citationPool: CbetaChunkHit[] = [];
    const worksScanned: string[] = [];
    const pageEnv = parseInt(
      this.config.get<string>('CBETA_DEEP_CHUNK_PAGE') || '',
      10,
    );
    const pageSize =
      Number.isFinite(pageEnv) && pageEnv > 0 ? pageEnv : CANDIDATE_POOL;

    for (let i = 0; i < workList.length; i++) {
      const w = workList[i];
      worksScanned.push(w.work_code);
      let offset = 0;
      let bestForWork: CbetaChunkHit | null = null;
      let bestNames = 0;

      for (;;) {
        const rows = await this.db.query<{
          id: string;
          work_code: string;
          collection: string;
          title_zh: string;
          juan_no: number | null;
          juan_label: string | null;
          chunk_index: number;
          content_zh: string;
          cbeta_ref_start: string | null;
        }>(
          `
          SELECT
            c.id, c.work_code, c.collection,
            COALESCE(c.title_zh, $1, '') AS title_zh,
            c.juan_no, c.juan_label, c.chunk_index, c.content_zh, c.cbeta_ref_start
          FROM chunks c
          WHERE c.work_code = $2
          ORDER BY c.chunk_index
          OFFSET $3 LIMIT $4
          `,
          [w.title_zh, w.work_code, offset, pageSize],
        );
        if (!rows.length) break;

        for (const r of rows) {
          const names = this.entities.extractFromText(r.content_zh);
          if (names.length) {
            this.entities.mergePassEntities(acc, names, r.work_code);
            await this.entities.upsertMentions(names, {
              workCode: r.work_code,
              collection: r.collection,
              chunkId: r.id,
              juanNo: r.juan_no,
            });
            if (names.length > bestNames) {
              bestNames = names.length;
              bestForWork = {
                id: r.id,
                workCode: r.work_code,
                collection: r.collection,
                titleZh: r.title_zh,
                juanNo: r.juan_no,
                juanLabel: r.juan_label,
                chunkIndex: r.chunk_index,
                contentZh: r.content_zh,
                score: names.length,
                cbetaRefStart: r.cbeta_ref_start,
              };
            }
          }
        }
        offset += rows.length;
        if (rows.length < pageSize) break;
      }

      if (bestForWork) citationPool.push(bestForWork);
      onProgress?.({
        pass: i + 1,
        totalPasses: workList.length,
        workCode: w.work_code,
        titleZh: w.title_zh,
        entityCount: acc.size,
      });
    }

    const entities: CbetaEntityHit[] = [...acc.entries()]
      .map(([nameZh, v]) => ({
        nameZh,
        count: v.count,
        works: [...v.works],
      }))
      .sort((a, b) => b.count - a.count || a.nameZh.localeCompare(b.nameZh, 'zh'));

    const fast = await this.retrieveFast(
      question,
      { ...decision, path: 'fast' },
      topK,
      options,
    );
    const merged = this.rerank(question, [
      ...citationPool,
      ...fast.hits,
    ]);
    const k = Math.max(1, topK ?? this.candidatePool());
    const hits = await this.expandNeighbors(merged.slice(0, k));

    return {
      hits,
      searchMode: 'deep',
      embedError: fast.embedError,
      entities,
      worksScanned,
      passes: workList.length,
    };
  }

  buildContextBlocks(
    hits: CbetaChunkHit[],
    entityBlock?: string,
  ): {
    blocks: string[];
    used: CbetaChunkHit[];
  } {
    const budget = this.contextCharBudget();
    const blocks: string[] = [];
    const used: CbetaChunkHit[] = [];
    let usedChars = 0;
    if (entityBlock?.trim()) {
      blocks.push(entityBlock.trim());
      usedChars += entityBlock.length;
    }
    const sorted = [...hits].sort((a, b) => b.score - a.score);

    for (const h of sorted) {
      const label = this.citationLabel(h);
      const body = h.contentZh.trim();
      if (!body) continue;
      const url = this.cbetaOnlineUrl(h.workCode, h.cbetaRefStart);
      const meta = [
        `work_code=${h.workCode}`,
        `collection=${h.collection}`,
        h.juanLabel?.trim() || (h.juanNo != null ? `juan=${h.juanNo}` : null),
        h.cbetaRefStart ? `ref=${h.cbetaRefStart}` : null,
        url ? `url=${url}` : null,
      ]
        .filter(Boolean)
        .join(' ');
      const block = `[CBETA]\nTrích dẫn: ${label}\n${meta}\n\n${body}`;
      if (used.length && usedChars + block.length > budget) break;
      blocks.push(block);
      used.push(h);
      usedChars += block.length;
    }
    return { blocks, used };
  }

  /** Public label for UI / LLM — no internal chunk index. */
  citationLabel(h: CbetaChunkHit): string {
    const juan =
      h.juanLabel?.trim() ||
      (h.juanNo != null ? `卷${h.juanNo}` : null);
    const ref = h.cbetaRefStart?.trim()
      ? `p.${h.cbetaRefStart.trim().replace(/^p/i, '')}`
      : null;
    const title = h.titleZh?.trim() || h.workCode;
    return [title, h.workCode, juan, ref].filter(Boolean).join(' · ');
  }

  cbetaOnlineUrl(
    workCode: string,
    cbetaRefStart: string | null | undefined,
  ): string | null {
    const tpl =
      this.config.get<string>('CBETA_ONLINE_URL_TEMPLATE') ||
      process.env.CBETA_ONLINE_URL_TEMPLATE ||
      '';
    return buildCbetaOnlineUrl(workCode, cbetaRefStart, tpl);
  }

  /** Lexical rerank on top of RRF / vector scores. */
  private rerank(question: string, hits: CbetaChunkHit[]): CbetaChunkHit[] {
    return hits
      .map((h) => {
        const lex = lexicalOverlapScore(question, h.contentZh);
        const titleBoost = lexicalOverlapScore(question, h.titleZh || '') * 0.25;
        return { ...h, score: h.score * 0.65 + lex * 0.3 + titleBoost };
      })
      .sort((a, b) => b.score - a.score);
  }

  private async listCoverageWorks(
    collections: string[],
  ): Promise<Array<{ work_code: string; title_zh: string; chunk_count: number }>> {
    const params: unknown[] = [];
    const where: string[] = ['TRUE'];
    const titleRe = this.coverageTitleRegex();
    if (titleRe) {
      params.push(titleRe);
      where.push(`title_zh ~ $${params.length}`);
    }
    if (collections.length) {
      params.push(collections);
      where.push(`collection = ANY($${params.length}::text[])`);
    }
    return this.db.query(
      `
      SELECT work_code, title_zh, coalesce(chunk_count, 0)::int AS chunk_count
      FROM works
      WHERE ${where.join(' AND ')}
      ORDER BY chunk_count DESC NULLS LAST, work_code ASC
      `,
      params,
    );
  }

  private filterSql(decision: CbetaRouteDecision): {
    sql: string;
    params: unknown[];
  } {
    const parts: string[] = [];
    const params: unknown[] = [];
    if (decision.collections.length) {
      params.push(decision.collections);
      parts.push(`c.collection = ANY($${params.length}::text[])`);
    }
    if (decision.workCodes.length) {
      params.push(decision.workCodes);
      parts.push(`c.work_code = ANY($${params.length}::text[])`);
    }
    const titleRe = this.coverageTitleRegex();
    if (
      decision.path === 'deep' &&
      decision.coverageMode &&
      !decision.collections.length &&
      titleRe
    ) {
      params.push(titleRe);
      parts.push(`c.title_zh ~ $${params.length}`);
    }
    return {
      sql: parts.length ? `AND ${parts.join(' AND ')}` : '',
      params,
    };
  }

  private async searchVector(
    vector: number[],
    limit: number,
    filter: { sql: string; params: unknown[] },
  ): Promise<CbetaChunkHit[]> {
    const literal = this.embedding.toVectorLiteral(vector);
    const params = [literal, limit, ...filter.params];
    // $1 vector, $2 limit, then filter params shifted by +2
    let filterSql = filter.sql;
    if (filter.params.length) {
      filterSql = filter.sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 2}`);
    }
    const rows = await this.db.query<{
      id: string;
      work_code: string;
      collection: string;
      title_zh: string;
      juan_no: number | null;
      juan_label: string | null;
      chunk_index: number;
      content_zh: string;
      cbeta_ref_start: string | null;
      score: number;
    }>(
      `
      SELECT
        c.id,
        c.work_code,
        c.collection,
        COALESCE(c.title_zh, w.title_zh, '') AS title_zh,
        c.juan_no,
        c.juan_label,
        c.chunk_index,
        c.content_zh,
        c.cbeta_ref_start,
        (1 - (e.embedding <=> $1::vector))::float8 AS score
      FROM chunk_embeddings e
      JOIN chunks c ON c.id = e.chunk_id
      JOIN works w ON w.work_code = c.work_code
      WHERE TRUE
        ${filterSql}
      ORDER BY e.embedding <=> $1::vector
      LIMIT $2
      `,
      params,
    );
    return rows.map((r) => this.toHit(r));
  }

  /**
   * FTS with OR of lexical terms (CJK n-grams + keywords).
   * plainto_tsquery ANDs tokens and fails for Chinese multi-phrase rewrite strings.
   */
  private async searchFts(
    question: string,
    terms: string[],
    limit: number,
    filter: { sql: string; params: unknown[] },
    path: 'fast' | 'deep',
  ): Promise<CbetaChunkHit[]> {
    const tsQuery =
      buildOrTsQuery(terms) ||
      buildOrTsQuery(extractLexicalTerms(question, [], parseNgramSizes(
        this.config.get<string>('CBETA_LEXICAL_NGRAMS') ||
          process.env.CBETA_LEXICAL_NGRAMS,
      )));
    if (!tsQuery) return [];

    const params = [tsQuery, limit, ...filter.params];
    let filterSql = filter.sql;
    if (filter.params.length) {
      filterSql = filter.sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 2}`);
    }
    const orderSql =
      path === 'deep'
        ? `ORDER BY c.work_code ASC, c.chunk_index ASC, ts_rank(
             to_tsvector('simple', c.content_zh),
             to_tsquery('simple', $1)
           ) DESC`
        : `ORDER BY ts_rank(
             to_tsvector('simple', c.content_zh),
             to_tsquery('simple', $1)
           ) DESC`;

    try {
      const rows = await this.db.query<{
        id: string;
        work_code: string;
        collection: string;
        title_zh: string;
        juan_no: number | null;
        juan_label: string | null;
        chunk_index: number;
        content_zh: string;
        cbeta_ref_start: string | null;
        score: number;
      }>(
        `
        SELECT
          c.id,
          c.work_code,
          c.collection,
          COALESCE(c.title_zh, w.title_zh, '') AS title_zh,
          c.juan_no,
          c.juan_label,
          c.chunk_index,
          c.content_zh,
          c.cbeta_ref_start,
          ts_rank(
            to_tsvector('simple', c.content_zh),
            to_tsquery('simple', $1)
          )::float8 AS score
        FROM chunks c
        JOIN works w ON w.work_code = c.work_code
        WHERE to_tsvector('simple', c.content_zh) @@ to_tsquery('simple', $1)
          ${filterSql}
        ${orderSql}
        LIMIT $2
        `,
        params,
      );
      return rows.map((r) => this.toHit(r));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`CBETA FTS failed: ${msg}`);
      return [];
    }
  }

  /**
   * Substring / trigram lexical channel when FTS tokens miss (common for CJK).
   * Patterns come from extracted terms only — no fixed word list.
   */
  private async searchLexical(
    terms: string[],
    limit: number,
    filter: { sql: string; params: unknown[] },
  ): Promise<CbetaChunkHit[]> {
    const patterns = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2))];
    if (!patterns.length) return [];

    const params: unknown[] = [patterns, limit, ...filter.params];
    let filterSql = filter.sql;
    if (filter.params.length) {
      filterSql = filter.sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 2}`);
    }

    try {
      const rows = await this.db.query<{
        id: string;
        work_code: string;
        collection: string;
        title_zh: string;
        juan_no: number | null;
        juan_label: string | null;
        chunk_index: number;
        content_zh: string;
        cbeta_ref_start: string | null;
        score: number;
      }>(
        `
        SELECT
          c.id,
          c.work_code,
          c.collection,
          COALESCE(c.title_zh, w.title_zh, '') AS title_zh,
          c.juan_no,
          c.juan_label,
          c.chunk_index,
          c.content_zh,
          c.cbeta_ref_start,
          (
            SELECT count(*)::float8
            FROM unnest($1::text[]) AS t(term)
            WHERE position(t.term IN c.content_zh) > 0
          ) AS score
        FROM chunks c
        JOIN works w ON w.work_code = c.work_code
        WHERE EXISTS (
          SELECT 1 FROM unnest($1::text[]) AS t(term)
          WHERE position(t.term IN c.content_zh) > 0
        )
          ${filterSql}
        ORDER BY score DESC, c.work_code ASC, c.chunk_index ASC
        LIMIT $2
        `,
        params,
      );
      return rows.map((r) => this.toHit(r));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`CBETA lexical search failed: ${msg}`);
      return [];
    }
  }

  private fuseRrf(
    vectorHits: CbetaChunkHit[],
    ftsHits: CbetaChunkHit[],
  ): CbetaChunkHit[] {
    const scores = new Map<string, number>();
    const byId = new Map<string, CbetaChunkHit>();
    const add = (list: CbetaChunkHit[]) => {
      list.forEach((h, i) => {
        byId.set(h.id, h);
        scores.set(h.id, (scores.get(h.id) || 0) + 1 / (RRF_K + i + 1));
      });
    };
    add(vectorHits);
    add(ftsHits);
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => {
        const hit = byId.get(id)!;
        return { ...hit, score };
      });
  }

  /** Expand ±1 chunk on the same work for top hits (continuity). */
  private async expandNeighbors(
    hits: CbetaChunkHit[],
  ): Promise<CbetaChunkHit[]> {
    if (!hits.length) return hits;
    const out: CbetaChunkHit[] = [];
    const seen = new Set<string>();
    // Expand only the strongest hits to keep latency low on large corpora.
    const envN = parseInt(this.config.get<string>('CBETA_EXPAND_HITS') || '', 10);
    const expandN = Math.min(
      hits.length,
      Number.isFinite(envN) && envN > 0 ? envN : LOOKUP_TOP_K,
    );
    for (const h of hits.slice(0, expandN)) {
      const idxs = [h.chunkIndex - 1, h.chunkIndex, h.chunkIndex + 1].filter(
        (n) => n >= 0,
      );
      const rows = await this.db.query<{
        id: string;
        work_code: string;
        collection: string;
        title_zh: string;
        juan_no: number | null;
        juan_label: string | null;
        chunk_index: number;
        content_zh: string;
        cbeta_ref_start: string | null;
      }>(
        `
        SELECT
          c.id, c.work_code, c.collection,
          COALESCE(c.title_zh, '') AS title_zh,
          c.juan_no, c.juan_label, c.chunk_index, c.content_zh, c.cbeta_ref_start
        FROM chunks c
        WHERE c.work_code = $1 AND c.chunk_index = ANY($2::int[])
        ORDER BY c.chunk_index
        `,
        [h.workCode, idxs],
      );
      for (const r of rows) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push({
          id: r.id,
          workCode: r.work_code,
          collection: r.collection,
          titleZh: r.title_zh || h.titleZh,
          juanNo: r.juan_no,
          juanLabel: r.juan_label,
          chunkIndex: r.chunk_index,
          contentZh: r.content_zh,
          score: r.id === h.id ? h.score : h.score * 0.85,
          cbetaRefStart: r.cbeta_ref_start,
        });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }

  private toHit(r: {
    id: string;
    work_code: string;
    collection: string;
    title_zh: string;
    juan_no: number | null;
    juan_label: string | null;
    chunk_index: number;
    content_zh: string;
    cbeta_ref_start: string | null;
    score: number;
  }): CbetaChunkHit {
    return {
      id: r.id,
      workCode: r.work_code,
      collection: r.collection,
      titleZh: r.title_zh,
      juanNo: r.juan_no,
      juanLabel: r.juan_label,
      chunkIndex: r.chunk_index,
      contentZh: r.content_zh,
      score: Number(r.score) || 0,
      cbetaRefStart: r.cbeta_ref_start,
    };
  }
}
