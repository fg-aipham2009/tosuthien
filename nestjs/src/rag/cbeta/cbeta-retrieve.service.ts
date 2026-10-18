import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from '../embedding.service';
import { CANDIDATE_POOL, LOOKUP_TOP_K } from '../rag.constants';
import { CbetaDbService } from './cbeta-db.service';
import { CbetaEntitiesService } from './cbeta-entities.service';
import { lexicalOverlapScore } from './cbeta-entity.util';
import type {
  CbetaChunkHit,
  CbetaDeepProgress,
  CbetaEntityHit,
  CbetaRetrieveResult,
  CbetaRouteDecision,
} from './cbeta.types';

const RRF_K = 60;

/** Title patterns for coverage / denglu-style works (deep path seed). */
const COVERAGE_TITLE_SQL = `
  title_zh ~ '傳燈|五燈|指月|高僧傳|續燈|會元|燈錄|禪林'
`;

@Injectable()
export class CbetaRetrieveService {
  private readonly logger = new Logger(CbetaRetrieveService.name);

  constructor(
    private readonly db: CbetaDbService,
    private readonly embedding: EmbeddingService,
    private readonly config: ConfigService,
    private readonly entities: CbetaEntitiesService,
  ) {}

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
  ): Promise<CbetaRetrieveResult> {
    if (decision.path === 'deep') {
      return this.retrieveDeep(question, decision, topK);
    }
    return this.retrieveFast(question, decision, topK);
  }

  async retrieveFast(
    question: string,
    decision: CbetaRouteDecision,
    topK?: number,
  ): Promise<CbetaRetrieveResult> {
    const pool = this.candidatePool();
    const k = Math.max(1, topK ?? pool);
    const filter = this.filterSql({ ...decision, path: 'fast' });

    let embedError: string | null = null;
    let vectorHits: CbetaChunkHit[] = [];
    try {
      const vec = await this.embedding.embed(question);
      vectorHits = await this.searchVector(vec, pool, filter);
    } catch (err: unknown) {
      embedError = err instanceof Error ? err.message : String(err);
      this.logger.warn(`CBETA embed failed: ${embedError}`);
    }

    const ftsHits = await this.searchFts(question, pool, filter, 'fast');

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

    hits = this.rerank(question, hits).slice(0, k);
    hits = await this.expandNeighbors(hits);
    return { hits, searchMode, embedError };
  }

  /**
   * Coverage multi-pass: scan denglu/lamp works for master names, upsert entities,
   * then hybrid+rerank for citation context.
   */
  async retrieveDeep(
    question: string,
    decision: CbetaRouteDecision,
    topK?: number,
    onProgress?: (p: CbetaDeepProgress) => void,
  ): Promise<CbetaRetrieveResult> {
    const works = await this.listCoverageWorks(decision.collections);
    const maxWorksEnv = parseInt(
      this.config.get<string>('CBETA_DEEP_MAX_WORKS') || '',
      10,
    );
    const workList =
      Number.isFinite(maxWorksEnv) && maxWorksEnv > 0
        ? works.slice(0, maxWorksEnv)
        : works;

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
      const block = `[CBETA]\nTrích dẫn: ${label}\nwork_code=${h.workCode} collection=${h.collection} chunk=${h.chunkIndex}\n\n${body}`;
      if (used.length && usedChars + block.length > budget) break;
      blocks.push(block);
      used.push(h);
      usedChars += block.length;
    }
    return { blocks, used };
  }

  citationLabel(h: CbetaChunkHit): string {
    const juan =
      h.juanLabel?.trim() ||
      (h.juanNo != null ? `卷${h.juanNo}` : `chunk ${h.chunkIndex}`);
    const title = h.titleZh?.trim() || h.workCode;
    return `${title} · ${h.workCode} · ${juan}`;
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
    let collSql = '';
    if (collections.length) {
      params.push(collections);
      collSql = `AND collection = ANY($${params.length}::text[])`;
    }
    return this.db.query(
      `
      SELECT work_code, title_zh, coalesce(chunk_count, 0)::int AS chunk_count
      FROM works
      WHERE (${COVERAGE_TITLE_SQL})
        ${collSql}
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
    if (decision.path === 'deep' && !decision.collections.length) {
      // Prefer denglu / lamp records when doing coverage without a master filter.
      parts.push(`(${COVERAGE_TITLE_SQL.replace(/title_zh/g, 'c.title_zh')})`);
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

  private async searchFts(
    question: string,
    limit: number,
    filter: { sql: string; params: unknown[] },
    path: 'fast' | 'deep',
  ): Promise<CbetaChunkHit[]> {
    const q = question.trim();
    if (!q) return [];
    const params = [q, limit, ...filter.params];
    let filterSql = filter.sql;
    if (filter.params.length) {
      filterSql = filter.sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 2}`);
    }
    const orderSql =
      path === 'deep'
        ? `ORDER BY c.work_code ASC, c.chunk_index ASC, ts_rank(
             to_tsvector('simple', c.content_zh),
             plainto_tsquery('simple', $1)
           ) DESC`
        : `ORDER BY ts_rank(
             to_tsvector('simple', c.content_zh),
             plainto_tsquery('simple', $1)
           ) DESC`;

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
          plainto_tsquery('simple', $1)
        )::float8 AS score
      FROM chunks c
      JOIN works w ON w.work_code = c.work_code
      WHERE to_tsvector('simple', c.content_zh) @@ plainto_tsquery('simple', $1)
        ${filterSql}
      ${orderSql}
      LIMIT $2
      `,
      params,
    );
    return rows.map((r) => this.toHit(r));
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
