import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { LlmService } from './llm.service';
import { AiConfigService } from './ai-config.service';
import { CitationLinkService } from './citation-link.service';
import {
  PassageHit,
  ChatResult,
  ChatCitation,
  ChatStreamEvent,
} from './rag.types';
import { RAG_DISCLAIMER, clampTopK, CANDIDATE_POOL } from './rag.constants';
import { expandKeywords, questionStem, analyzeQuery } from './rag-keywords.util';
import { isKinhSource, sourceTier, toPrintedPage, printedPageOffset } from './rag-source.util';
import {
  maxPassageCharsForTier,
  resolveAnswerStyle,
  tierLabel,
  type AnswerStyle,
  type AnswerStyleContext,
} from './rag-answer-style';

/** Cap LLM context — neighbor ±1 pages need room for full paragraphs. */
const MAX_CONTEXT_CHARS = 28_000;
/** Soft cap for citation quote — prefer whole paragraphs under this size. */
const QUOTE_MAX_CHARS = 4_800;
const MAX_DISPLAY_CITATIONS = 16;
const SENTENCE_ENDINGS = /[.!?;:…]/;
const PARAGRAPH_SPLIT = /\n{2,}|(?=\[Trang\s+\d+\])/;
/** Reciprocal Rank Fusion constant — dịu ảnh hưởng thứ hạng thấp (chuẩn ~60) */
const RRF_K = 60;
/** Minimum keyword/synonym overlap to send a passage to the LLM */
const MIN_RELEVANCE_SCORE = 1;
/** Score boost when all co-occurrence groups match (entity + topic). */
const COOC_SCORE = 0.95;
/** Score boost for passages from kinh / nguyên tác (non–Duy Lực Ngữ Lục). */
const KINH_TIER_SCORE = 0.92;
const KINH_RANK_BOOST = 0.38;
const NGU_LUC_RANK_PENALTY = 0.06;

const STOP_WORDS = new Set([
  'thế', 'nào', 'là', 'gì', 'sao', 'như', 'có', 'không', 'được', 'trong',
  'của', 'và', 'hoặc', 'hay', 'để', 'với', 'về', 'cho', 'tôi', 'bạn', 'khi',
  'ai', 'đâu', 'tại', 'vì', 'mà', 'cũng', 'rất', 'một', 'các', 'những', 'thì',
  'phải', 'nên', 'đã', 'sẽ', 'đang', 'vẫn', 'còn', 'ra', 'vào', 'lên', 'xuống',
  'hỏi', 'tra', 'cứu', 'tìm', 'biết', 'nghĩa', 'làm', 'cách', 'phương', 'pháp',
]);

const META_MARKERS = [
  'GIÁO HỘI PHẬT GIÁO',
  'NHÀ XUẤT BẢN',
  'THÀNH HỘI PHẬT GIÁO',
  'TỔ IN ẤN',
  'PL:',
  'DL:',
  'Dịch giả:',
  'Tái bản',
  'LỜI ĐẦU SÁCH',
  'Nhật ký ngày',
];

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
    private readonly llm: LlmService,
    private readonly ai: AiConfigService,
    private readonly citationLinks: CitationLinkService,
  ) {}

  async chat(question: string, topK?: number): Promise<ChatResult> {
    const totalStart = Date.now();
    const prepared = await this.prepareChat(question, topK);
    if (prepared.kind === 'empty') {
      return this.emptyResult({
        ...prepared.meta,
        totalMs: Date.now() - totalStart,
      });
    }

    const llmStart = Date.now();
    // Expand ±1 page before LLM so answers/quotes use full neighboring context.
    const expandedHits = await this.expandHitsWithNeighborPages(prepared.hits);
    const { blocks, citations } = this.buildContext(
      expandedHits,
      prepared.keywords,
    );
    if (!blocks.length) {
      return this.emptyResult({
        ...prepared.meta,
        totalMs: Date.now() - totalStart,
      });
    }

    const answer = await this.llm.answer(
      prepared.q,
      blocks,
      prepared.styleContext,
    );
    const llmMs = Date.now() - llmStart;

    const displayCitations = await this.prepareDisplayCitations(
      citations.length ? citations : prepared.slimCitations,
      prepared.keywords,
      prepared.sourceHints,
    );

    return {
      answer,
      disclaimer: RAG_DISCLAIMER,
      citations: displayCitations,
      meta: {
        ...prepared.meta,
        llmMs,
        totalMs: Date.now() - totalStart,
      },
    };
  }

  /** SSE stream: status → delta* → done (or error via controller). */
  async *chatStream(
    question: string,
    topK?: number,
  ): AsyncGenerator<ChatStreamEvent> {
    const totalStart = Date.now();
    yield { type: 'status', phase: 'retrieving' };

    const prepared = await this.prepareChat(question, topK);
    if (prepared.kind === 'empty') {
      const empty = this.emptyResult({
        ...prepared.meta,
        totalMs: Date.now() - totalStart,
      });
      yield {
        type: 'done',
        answer: empty.answer,
        disclaimer: empty.disclaimer,
        citations: empty.citations,
        meta: empty.meta,
      };
      return;
    }

    yield { type: 'status', phase: 'generating' };

    const llmStart = Date.now();
    const expandedHits = await this.expandHitsWithNeighborPages(prepared.hits);
    const { blocks, citations } = this.buildContext(
      expandedHits,
      prepared.keywords,
    );
    if (!blocks.length) {
      const empty = this.emptyResult({
        ...prepared.meta,
        totalMs: Date.now() - totalStart,
      });
      yield {
        type: 'done',
        answer: empty.answer,
        disclaimer: empty.disclaimer,
        citations: empty.citations,
        meta: empty.meta,
      };
      return;
    }

    const parts: string[] = [];
    for await (const text of this.llm.answerStream(
      prepared.q,
      blocks,
      prepared.styleContext,
    )) {
      parts.push(text);
      yield { type: 'delta', text };
    }

    const llmMs = Date.now() - llmStart;
    const displayCitations = await this.prepareDisplayCitations(
      citations.length ? citations : prepared.slimCitations,
      prepared.keywords,
      prepared.sourceHints,
    );

    const answer = parts.join('').trim();
    yield {
      type: 'done',
      answer:
        answer ||
        'Trong tư liệu hiện có chưa tìm thấy đoạn liên quan. Hãy thử hỏi theo từ khóa khác.',
      disclaimer: RAG_DISCLAIMER,
      citations: displayCitations,
      meta: {
        ...prepared.meta,
        llmMs,
        totalMs: Date.now() - totalStart,
      },
    };
  }

  private async prepareChat(
    question: string,
    topK?: number,
  ): Promise<
    | { kind: 'empty'; meta: ChatResult['meta'] }
    | {
        kind: 'ready';
        q: string;
        keywords: string[];
        sourceHints: string[];
        hits: PassageHit[];
        blocks: string[];
        slimCitations: Omit<ChatCitation, 'pdf' | 'openLabel'>[];
        styleContext: AnswerStyleContext;
        meta: ChatResult['meta'];
      }
  > {
    const q = question.trim();
    if (q.length < 2) throw new BadRequestException('Câu hỏi quá ngắn');

    const { keywords, mustGroups, topicTerms, sourceHints } = analyzeQuery(
      q,
      STOP_WORDS,
    );
    const searchKeywords = expandKeywords(keywords);
    const stem = questionStem(q);
    const k = clampTopK(topK, q, keywords.length);

    const retrievalStart = Date.now();
    const kinhTerms = searchKeywords.length ? searchKeywords : topicTerms;

    // Start query embedding in parallel with DB searches (ignored when no embeddings in DB)
    const embedPromise = this.embedding.embed(q).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Query embed failed, falling back to FTS: ${msg}`);
      return null;
    });

    const [embeddingCount, ftsCandidates, coocCandidates, kinhCandidates] =
      await Promise.all([
        this.countEmbeddings(),
        this.searchPassagesFts(searchKeywords, CANDIDATE_POOL),
        mustGroups.length >= 2
          ? this.searchPassagesCooccurrence(mustGroups, 15)
          : Promise.resolve([] as PassageHit[]),
        this.searchPassagesKinhTier(kinhTerms, 22),
      ]);

    let candidates: PassageHit[];
    let searchMode: 'hybrid' | 'vector' | 'fts';
    let embedError: string | null = null;

    if (embeddingCount > 0) {
      const queryVector = await embedPromise;
      if (queryVector) {
        const vectorCandidates = await this.searchPassagesVector(
          queryVector,
          CANDIDATE_POOL,
        );
        candidates = this.mergeCandidates(
          kinhCandidates,
          this.mergeCandidates(
            coocCandidates,
            this.fuseRrf(vectorCandidates, ftsCandidates),
          ),
        );
        searchMode = 'hybrid';
      } else {
        candidates = this.mergeCandidates(
          kinhCandidates,
          this.mergeCandidates(coocCandidates, ftsCandidates),
        );
        searchMode = 'fts';
        embedError = 'embed_failed';
      }
    } else {
      await embedPromise;
      candidates = this.mergeCandidates(
        kinhCandidates,
        this.mergeCandidates(coocCandidates, ftsCandidates),
      );
      searchMode = 'fts';
    }

    const retrievalMs = Date.now() - retrievalStart;

    const rankedHits = this.ensureKinhFirstMix(
      this.selectRelevantHits(
        this.boostQaHits(
          this.filterJunkPassages(candidates),
          keywords,
          searchKeywords,
          stem,
          mustGroups,
          sourceHints,
        ),
        keywords,
        searchKeywords,
        stem,
        mustGroups,
        sourceHints,
        k,
      ),
      candidates,
      k,
    );

    const relevanceOf = (h: PassageHit) =>
      this.relevanceScore(
        h,
        keywords,
        searchKeywords,
        stem,
        mustGroups,
        sourceHints,
      );

    const styleContext = resolveAnswerStyle(rankedHits, relevanceOf);
    const hits = this.diversifyBySource(
      this.trimHitsForStyle(rankedHits, styleContext.style, relevanceOf),
      Math.max(k, 8),
    );

    const meta: ChatResult['meta'] = {
      topK: topK ?? k,
      topKResolved: k,
      embeddingCount,
      searchMode,
      retrievalMs,
      embedError,
      answerStyle: styleContext.style,
      chatProvider: this.ai.get().chatProvider,
    };

    if (!hits.length) {
      return { kind: 'empty', meta };
    }

    // Slim hits for the LLM (faster). Neighbor pages expand for citations only.
    const { blocks, citations: slimCitations } = this.buildContext(
      hits,
      keywords,
    );
    if (!blocks.length) {
      return { kind: 'empty', meta };
    }

    return {
      kind: 'ready',
      q,
      keywords,
      sourceHints,
      hits,
      blocks,
      slimCitations,
      styleContext,
      meta,
    };
  }

  private emptyResult(meta: ChatResult['meta']): ChatResult {
    return {
      answer:
        'Trong tư liệu hiện có chưa tìm thấy đoạn liên quan. Hãy thử hỏi theo từ khóa khác.',
      disclaimer: RAG_DISCLAIMER,
      citations: [],
      meta,
    };
  }

  private async prepareDisplayCitations(
    citations: Omit<ChatCitation, 'pdf' | 'openLabel'>[],
    keywords: string[],
    sourceHints: string[],
  ): Promise<ChatCitation[]> {
    const ranked = [...citations]
      .filter((c) => this.isRelevantCitation(c, keywords, sourceHints))
      .sort(
        (a, b) => this.citationRank(b, keywords) - this.citationRank(a, keywords),
      );

    const diversified = this.diversifyCitationsBySource(
      ranked,
      MAX_DISPLAY_CITATIONS,
    );

    return this.citationLinks.enrichCitations(diversified);
  }

  /**
   * Round-robin across source files so citations aren't dominated by one book.
   */
  private diversifyCitationsBySource(
    citations: Omit<ChatCitation, 'pdf' | 'openLabel'>[],
    limit: number,
  ): Omit<ChatCitation, 'pdf' | 'openLabel'>[] {
    if (citations.length <= limit) return citations;

    const queues = new Map<string, Omit<ChatCitation, 'pdf' | 'openLabel'>[]>();
    for (const c of citations) {
      const key = c.sourceFile || c.title || 'unknown';
      const list = queues.get(key) ?? [];
      list.push(c);
      queues.set(key, list);
    }

    const buckets = [...queues.values()];
    const out: Omit<ChatCitation, 'pdf' | 'openLabel'>[] = [];
    let i = 0;
    while (out.length < limit && buckets.some((b) => b.length > 0)) {
      const bucket = buckets[i % buckets.length];
      if (bucket.length) out.push(bucket.shift()!);
      i++;
    }
    return out;
  }

  /**
   * Prefer passages from different books so the LLM can quote diversely.
   */
  private diversifyBySource(hits: PassageHit[], limit: number): PassageHit[] {
    if (hits.length <= 1) return hits;

    const queues = new Map<string, PassageHit[]>();
    for (const h of hits) {
      const key = h.sourceFile || h.title || 'unknown';
      const list = queues.get(key) ?? [];
      list.push(h);
      queues.set(key, list);
    }

    const buckets = [...queues.values()];
    const out: PassageHit[] = [];
    let i = 0;
    while (out.length < limit && buckets.some((b) => b.length > 0)) {
      const bucket = buckets[i % buckets.length];
      if (bucket.length) out.push(bucket.shift()!);
      i++;
    }
    return out;
  }

  private citationRank(
    c: Omit<ChatCitation, 'pdf' | 'openLabel'>,
    keywords: string[],
  ): number {
    let rank = this.keywordHitScore(c.quote, keywords) * 10;
    if (isKinhSource(c.title, c.sourceFile)) rank += 15;
    else rank -= 3;
    if (c.pageNum != null) rank += 3;
    rank += Number(c.score);
    return rank;
  }

  private isRelevantCitation(
    c: Omit<ChatCitation, 'pdf' | 'openLabel'>,
    keywords: string[],
    sourceHints: string[],
  ): boolean {
    if (this.isJunkPassage(c.excerpt)) return false;
    if (sourceHints.length && !this.matchesSourceHints(c, sourceHints)) {
      return false;
    }
    if (!keywords.length) return true;
    return this.keywordHitScore(c.quote, keywords) > 0
      || this.keywordHitScore(c.excerpt, keywords) > 0;
  }

  private async countEmbeddings(): Promise<number> {
    const [{ count }] = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM passage_embeddings
    `;
    return Number(count);
  }

  private mergeCandidates(
    priority: PassageHit[],
    rest: PassageHit[],
  ): PassageHit[] {
    const seen = new Set<string>();
    const out: PassageHit[] = [];
    for (const h of [...priority, ...rest]) {
      if (seen.has(h.passageId)) continue;
      seen.add(h.passageId);
      out.push(h);
    }
    return out;
  }

  /** Passage must match at least one term from each group (e.g. figure AND topic). */
  private async searchPassagesCooccurrence(
    mustGroups: string[][],
    limit: number,
  ): Promise<PassageHit[]> {
    if (!mustGroups.length) return [];

    const groupConds = mustGroups.map((group) => {
      const ors = group.map(
        (term) => Prisma.sql`p.content ILIKE ${'%' + term + '%'}`,
      );
      return Prisma.sql`(${Prisma.join(ors, ' OR ')})`;
    });
    const where = Prisma.join(groupConds, ' AND ');

    const rows = await this.prisma.$queryRaw<PassageHit[]>`
      SELECT
        p.id AS "passageId",
        p.content,
        p.page_num AS "pageNum",
        p.chunk_type AS "chunkType",
        r.title,
        r.volume,
        r.source_file AS "sourceFile",
        ${COOC_SCORE}::float8 AS score
      FROM passages p
      JOIN rag_sources r ON r.id = p.rag_source_id
      WHERE ${where}
      ORDER BY length(p.content) ASC, p.page_num NULLS LAST
      LIMIT ${limit}
    `;

    return rows.map((r) => ({ ...r, score: Number(r.score) }));
  }

  /** Kinh / nguyên tác (exclude HT Duy Lực Ngữ Lục) matching topic terms. */
  private async searchPassagesKinhTier(
    terms: string[],
    limit: number,
  ): Promise<PassageHit[]> {
    const unique = [
      ...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2)),
    ].slice(0, 10);
    if (!unique.length) return [];

    const topicOrs = unique.map(
      (t) => Prisma.sql`p.content ILIKE ${'%' + t + '%'}`,
    );

    const rows = await this.prisma.$queryRaw<PassageHit[]>`
      SELECT
        p.id AS "passageId",
        p.content,
        p.page_num AS "pageNum",
        p.chunk_type AS "chunkType",
        r.title,
        r.volume,
        r.source_file AS "sourceFile",
        ${KINH_TIER_SCORE}::float8 AS score
      FROM passages p
      JOIN rag_sources r ON r.id = p.rag_source_id
      WHERE r.source_file NOT IN ('13.txt', '14.txt')
        AND NOT (r.title ILIKE '%duy lực ngữ lục%')
        AND (${Prisma.join(topicOrs, ' OR ')})
      ORDER BY length(p.content) ASC, p.page_num NULLS LAST
      LIMIT ${limit}
    `;

    return rows.map((r) => ({ ...r, score: Number(r.score) }));
  }

  /** Ensure majority of topK are from kinh/nguyên tác when the pool has matches. */
  private ensureKinhFirstMix(
    hits: PassageHit[],
    pool: PassageHit[],
    k: number,
  ): PassageHit[] {
    if (!hits.length) return hits;

    const minKinh = Math.min(Math.max(2, Math.ceil(k * 0.55)), k);
    const seen = new Set<string>();
    const out: PassageHit[] = [];

    const countKinh = () =>
      out.filter((h) => isKinhSource(h.title, h.sourceFile)).length;

    const push = (h: PassageHit) => {
      if (seen.has(h.passageId)) return;
      seen.add(h.passageId);
      out.push(h);
    };

    for (const h of hits.filter((x) => isKinhSource(x.title, x.sourceFile))) {
      if (out.length >= k) break;
      push(h);
    }

    if (countKinh() < minKinh) {
      for (const h of pool) {
        if (countKinh() >= minKinh || out.length >= k) break;
        if (!isKinhSource(h.title, h.sourceFile)) continue;
        push(h);
      }
    }

    for (const h of [...hits, ...pool]) {
      if (out.length >= k) break;
      push(h);
    }

    return out.slice(0, k);
  }

  private matchesMustGroups(content: string, mustGroups: string[][]): boolean {
    if (!mustGroups.length) return false;
    const lower = content.toLowerCase();
    return mustGroups.every((group) =>
      group.some((term) => lower.includes(term.toLowerCase())),
    );
  }

  private async searchPassagesVector(vector: number[], limit: number): Promise<PassageHit[]> {
    const literal = this.embedding.toVectorLiteral(vector);

    const rows = (await this.prisma.$queryRawUnsafe(
      `
      SELECT
        p.id AS "passageId",
        p.content,
        p.page_num AS "pageNum",
        p.chunk_type AS "chunkType",
        r.title,
        r.volume,
        r.source_file AS "sourceFile",
        (1 - (e.embedding <=> $1::vector))::float8 AS score
      FROM passage_embeddings e
      JOIN passages p ON p.id = e.passage_id
      JOIN rag_sources r ON r.id = p.rag_source_id
      ORDER BY e.embedding <=> $1::vector
      LIMIT $2
      `,
      literal,
      limit,
    )) as PassageHit[];

    return rows.map((r) => ({ ...r, score: Number(r.score) }));
  }

  private async searchPassagesFts(
    keywords: string[],
    limit: number,
  ): Promise<PassageHit[]> {
    if (!keywords.length) return [];

    const ftsQuery = keywords.join(' ');
    const rowsById = new Map<string, PassageHit>();

    // Gộp kết quả FTS + ILIKE (AND rồi OR) để tăng recall, khử trùng theo passageId
    const merge = (rows: PassageHit[]) => {
      for (const r of rows) if (!rowsById.has(r.passageId)) rowsById.set(r.passageId, r);
    };

    merge(await this.runFtsQuery(ftsQuery, limit));
    if (keywords.length >= 2) {
      merge(await this.runIlikeQuery(keywords, limit, true));
    }
    merge(await this.runIlikeQuery(keywords, limit, false));

    return this.rankByKeywordHits([...rowsById.values()], keywords).slice(0, limit);
  }

  private runFtsQuery(query: string, limit: number): Promise<PassageHit[]> {
    return this.prisma.$queryRaw<PassageHit[]>`
      SELECT
        p.id AS "passageId",
        p.content,
        p.page_num AS "pageNum",
        p.chunk_type AS "chunkType",
        r.title,
        r.volume,
        r.source_file AS "sourceFile",
        ts_rank(
          to_tsvector('simple', p.content),
          plainto_tsquery('simple', ${query})
        )::float8 AS score
      FROM passages p
      JOIN rag_sources r ON r.id = p.rag_source_id
      WHERE to_tsvector('simple', p.content) @@ plainto_tsquery('simple', ${query})
      ORDER BY score DESC, p.page_num NULLS LAST
      LIMIT ${limit}
    `;
  }

  private runIlikeQuery(
    keywords: string[],
    limit: number,
    requireAll: boolean,
  ): Promise<PassageHit[]> {
    const conditions = keywords.map(
      (k) => Prisma.sql`p.content ILIKE ${'%' + k + '%'}`,
    );
    const where = requireAll
      ? Prisma.join(conditions, ' AND ')
      : Prisma.join(conditions, ' OR ');

    return this.prisma.$queryRaw<PassageHit[]>`
      SELECT
        p.id AS "passageId",
        p.content,
        p.page_num AS "pageNum",
        p.chunk_type AS "chunkType",
        r.title,
        r.volume,
        r.source_file AS "sourceFile",
        0.5::float8 AS score
      FROM passages p
      JOIN rag_sources r ON r.id = p.rag_source_id
      WHERE ${where}
      ORDER BY p.page_num NULLS LAST, length(p.content) ASC
      LIMIT ${limit}
    `;
  }

  /**
   * Reciprocal Rank Fusion: gộp 2 bảng xếp hạng khác thang điểm (cosine vs
   * ts_rank) mà không cần chuẩn hoá. Passage xuất hiện ở cả hai được cộng dồn.
   */
  private fuseRrf(
    vectorHits: PassageHit[],
    ftsHits: PassageHit[],
  ): PassageHit[] {
    const fused = new Map<string, number>();
    const byId = new Map<string, PassageHit>();

    const add = (hits: PassageHit[]) => {
      hits.forEach((h, rank) => {
        if (!byId.has(h.passageId)) byId.set(h.passageId, h);
        fused.set(
          h.passageId,
          (fused.get(h.passageId) ?? 0) + 1 / (RRF_K + rank + 1),
        );
      });
    };

    add(vectorHits);
    add(ftsHits);

    return [...byId.values()]
      .map((h) => ({ ...h, score: fused.get(h.passageId) ?? 0 }))
      .sort((a, b) => b.score - a.score);
  }

  private rankByKeywordHits(rows: PassageHit[], keywords: string[]): PassageHit[] {
    if (!keywords.length) return rows;

    return [...rows].sort((a, b) => {
      const scoreA = this.keywordHitScore(a.content, keywords);
      const scoreB = this.keywordHitScore(b.content, keywords);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return Number(b.score) - Number(a.score);
    });
  }

  private keywordHitScore(content: string, keywords: string[]): number {
    const lower = content.toLowerCase();
    let hits = 0;
    for (const k of keywords) {
      if (lower.includes(k)) hits++;
    }
    return hits;
  }

  /** Prefer Q&A chunks whose HỎI line matches query keywords (e.g. "thoại đầu là gì"). */
  private boostQaHits(
    hits: PassageHit[],
    keywords: string[],
    searchKeywords: string[],
    stem: string,
    mustGroups: string[][],
    sourceHints: string[],
  ): PassageHit[] {
    if (!keywords.length && !stem && !mustGroups.length) return hits;
    return [...hits].sort(
      (a, b) =>
        this.passageRank(b, keywords, searchKeywords, stem, mustGroups, sourceHints)
        - this.passageRank(a, keywords, searchKeywords, stem, mustGroups, sourceHints),
    );
  }

  private passageRank(
    h: PassageHit,
    keywords: string[],
    searchKeywords: string[],
    stem: string,
    mustGroups: string[][],
    sourceHints: string[],
  ): number {
    let rank = h.score;
    const head = h.content.slice(0, 320).toLowerCase();
    const qaQuestion = this.extractQaQuestion(h.content);

    if (isKinhSource(h.title, h.sourceFile)) rank += KINH_RANK_BOOST;
    else rank -= NGU_LUC_RANK_PENALTY;
    if (this.matchesMustGroups(h.content, mustGroups)) {
      rank += 0.5;
    }
    if (h.chunkType === 'qa') rank += 0.1;
    if (keywords.filter((k) => head.includes(k)).length >= Math.min(2, keywords.length)) {
      rank += 0.15;
    }
    rank += this.keywordHitScore(h.content, searchKeywords) * 0.04;

    if (qaQuestion) {
      const qLower = qaQuestion.toLowerCase();
      const stemWords = stem.split(/\s+/).filter((w) => w.length >= 2);
      const stemHits = stemWords.filter((w) => qLower.includes(w)).length;
      if (stemWords.length > 0 && stemHits >= Math.min(2, stemWords.length)) {
        rank += 0.25;
      } else if (stem.length >= 4 && qLower.includes(stem)) {
        rank += 0.3;
      }
      for (const k of keywords) {
        if (qLower.includes(k)) rank += 0.08;
      }
    }

    if (this.matchesSourceHints(h, sourceHints)) rank += 0.9;

    return rank;
  }

  private extractQaQuestion(content: string): string | null {
    const m = content.match(/HỎI\s*:\s*(.+)/i);
    return m?.[1]?.trim() ?? null;
  }

  /** Drop weak passages before LLM; always keep top 1–2 hybrid hits as fallback. */
  private selectRelevantHits(
    ranked: PassageHit[],
    keywords: string[],
    searchKeywords: string[],
    stem: string,
    mustGroups: string[][],
    sourceHints: string[],
    k: number,
  ): PassageHit[] {
    if (!ranked.length) return [];

    const scored = ranked.map((h) => ({
      hit: h,
      relevance: this.relevanceScore(
        h,
        keywords,
        searchKeywords,
        stem,
        mustGroups,
        sourceHints,
      ),
    }));

    const cooc = scored.filter((s) => this.matchesMustGroups(s.hit.content, mustGroups));
    const relevant = scored.filter((s) => s.relevance >= MIN_RELEVANCE_SCORE);
    const pool = cooc.length >= 1
      ? cooc
      : relevant.length >= 1
        ? relevant
        : scored.slice(0, Math.min(2, scored.length));

    return pool.slice(0, k).map((s) => s.hit);
  }

  private relevanceScore(
    h: PassageHit,
    keywords: string[],
    searchKeywords: string[],
    stem: string,
    mustGroups: string[][],
    sourceHints: string[],
  ): number {
    let score = this.keywordHitScore(h.content, searchKeywords);
    if (this.matchesMustGroups(h.content, mustGroups)) score += 5;
    if (this.matchesSourceHints(h, sourceHints)) score += 3;
    const qaQuestion = this.extractQaQuestion(h.content);
    if (qaQuestion) {
      const qLower = qaQuestion.toLowerCase();
      for (const k of keywords) {
        if (qLower.includes(k)) score += 2;
      }
      if (stem.length >= 4 && qLower.includes(stem)) score += 3;
    }
    return score;
  }

  private matchesSourceHints(
    hit: Pick<PassageHit, 'title' | 'sourceFile'>,
    sourceHints: string[],
  ): boolean {
    if (!sourceHints.length) return false;
    const blob = `${hit.title} ${hit.sourceFile}`.toLowerCase();
    if (sourceHints.some((h) => blob.includes(h.toLowerCase()))) return true;
    if (
      sourceHints.some((h) => h.includes('tham tổ sư thiền'))
      && hit.sourceFile === '21.txt'
    ) {
      return true;
    }
    return false;
  }

  private filterJunkPassages(hits: PassageHit[]): PassageHit[] {
    return hits.filter((h) => !this.isJunkPassage(h.content));
  }

  private isJunkPassage(content: string): boolean {
    const trimmed = content.trim();
    if (trimmed.length < 80) return true;

    if (META_MARKERS.some((m) => trimmed.includes(m)) && trimmed.length < 800) {
      return true;
    }

    const metaCount = META_MARKERS.filter((m) => trimmed.includes(m)).length;
    if (metaCount >= 2 && trimmed.length < 600) return true;

    const lines = trimmed.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length <= 3 && metaCount >= 1) return true;

    return false;
  }

  private trimHitsForStyle(
    hits: PassageHit[],
    style: AnswerStyle,
    relevanceOf: (h: PassageHit) => number,
  ): PassageHit[] {
    if (!hits.length) return hits;

    if (style === 'kinh_long') {
      const kinh = hits.filter((h) => isKinhSource(h.title, h.sourceFile));
      const pool = kinh.length ? kinh : hits;
      return pool.slice(0, Math.min(8, pool.length));
    }

    if (style === 'brief') {
      // Keep enough passages for multi-paragraph verbatim answers.
      const strong = hits.filter((h) => relevanceOf(h) >= MIN_RELEVANCE_SCORE + 1);
      const pool = strong.length ? strong : hits;
      return pool.slice(0, Math.min(8, pool.length));
    }

    // mixed: keep several kinh blocks + a few strong ngu luc blocks
    const kinh = hits.filter((h) => isKinhSource(h.title, h.sourceFile));
    const nguLuc = hits
      .filter((h) => !isKinhSource(h.title, h.sourceFile))
      .filter((h) => relevanceOf(h) >= MIN_RELEVANCE_SCORE + 1)
      .slice(0, 4);
    return [...kinh.slice(0, 8), ...nguLuc];
  }

  /**
   * Expand each hit with neighboring OCR pages (±1) from the same source file.
   * Avoids missing split content (e.g. "nghi tình" across tr.127–129).
   */
  private async expandHitsWithNeighborPages(
    hits: PassageHit[],
  ): Promise<PassageHit[]> {
    return Promise.all(
      hits.map(async (hit) => {
        if (hit.pageNum == null) return hit;

        const center = hit.pageNum;
        const pageStart = Math.max(1, center - 1);
        const pageEnd = center + 1;
        const neighbors = await this.fetchPagesAround(
          hit.sourceFile,
          pageStart,
          pageEnd,
        );

        if (!neighbors.length) return hit;

        const byPage = new Map<number, string[]>();
        for (const row of neighbors) {
          if (row.pageNum == null) continue;
          const list = byPage.get(row.pageNum) ?? [];
          list.push(row.content);
          byPage.set(row.pageNum, list);
        }

        // Always include the original hit content for its page.
        const hitPageParts = byPage.get(center) ?? [];
        if (!hitPageParts.some((c) => c === hit.content)) {
          hitPageParts.unshift(hit.content);
          byPage.set(center, hitPageParts);
        }

        const pages = [...byPage.keys()].sort((a, b) => a - b);
        const offset = printedPageOffset(hit.sourceFile);
        const mergedParts: string[] = [];
        for (const page of pages) {
          const body = (byPage.get(page) ?? []).join('\n\n').trim();
          if (!body) continue;
          // Label with printed page so the LLM cites the number readers see in the book.
          mergedParts.push(`[Trang ${page + offset}]\n${body}`);
        }

        if (!mergedParts.length) return hit;

        // Keep OCR/file pages on the hit for PDF open; display offset applied in buildContext.
        const openPage = pages[0] ?? center;

        return {
          ...hit,
          content: mergedParts.join('\n\n'),
          pageNum: openPage,
          pageStart: pages[0] ?? pageStart,
          pageEnd: pages[pages.length - 1] ?? pageEnd,
        } as PassageHit & { pageStart: number; pageEnd: number };
      }),
    );
  }

  private fetchPagesAround(
    sourceFile: string,
    pageStart: number,
    pageEnd: number,
  ): Promise<PassageHit[]> {
    return this.prisma.$queryRaw<PassageHit[]>`
      SELECT
        p.id AS "passageId",
        p.content,
        p.page_num AS "pageNum",
        p.chunk_type AS "chunkType",
        r.title,
        r.volume,
        r.source_file AS "sourceFile",
        0::float8 AS score
      FROM passages p
      JOIN rag_sources r ON r.id = p.rag_source_id
      WHERE r.source_file = ${sourceFile}
        AND p.page_num BETWEEN ${pageStart} AND ${pageEnd}
      ORDER BY p.page_num ASC NULLS LAST, length(p.content) ASC
    `;
  }

  private buildContext(hits: PassageHit[], keywords: string[]) {
    const citations: Omit<ChatCitation, 'pdf' | 'openLabel'>[] = [];
    const blocks: string[] = [];
    let used = 0;

    for (let i = 0; i < hits.length; i++) {
      const h = hits[i] as PassageHit & {
        pageStart?: number;
        pageEnd?: number;
      };
      // Hits store OCR/file pages; expose printed pages in labels + citations.
      const ocrStart = h.pageStart ?? h.pageNum;
      const ocrEnd = h.pageEnd ?? h.pageNum;
      const pageStart = toPrintedPage(h.sourceFile, ocrStart);
      const pageEnd = toPrintedPage(h.sourceFile, ocrEnd);
      const tier = sourceTier(h.title, h.sourceFile);
      const label = this.formatLabel(h.title, h.volume, pageStart, pageEnd);
      const header = `[Nguồn ${i + 1} | ${tierLabel(tier)}] ${label} (${h.sourceFile})`;

      const maxChars = maxPassageCharsForTier(tier);
      // Neighbor windows are larger — allow more chars so 3 pages aren't truncated away.
      const windowBonus =
        ocrStart != null && ocrEnd != null && ocrEnd > ocrStart
          ? Math.min(4_800, (ocrEnd - ocrStart) * 2_000)
          : 0;
      const body = this.trimPassageAtSentence(h.content, maxChars + windowBonus);
      const block = `${header}\n${body}`;
      if (used + block.length > MAX_CONTEXT_CHARS) break;

      blocks.push(block);
      used += block.length;

      const quote = this.extractQuote(body, keywords);

      citations.push({
        passageId: h.passageId,
        label,
        title: h.title,
        volume: h.volume,
        pageNum: pageStart ?? null,
        pageStart: pageStart ?? null,
        pageEnd: pageEnd ?? null,
        sourceFile: h.sourceFile,
        score: Math.round(h.score * 1000) / 1000,
        quote,
        excerpt: body,
      });
    }

    return { blocks, citations };
  }

  private formatLabel(
    title: string,
    volume: string | null,
    pageStart: number | null | undefined,
    pageEnd?: number | null,
  ): string {
    const parts = [title];
    if (volume) parts.push(volume);
    if (pageStart != null && pageEnd != null && pageEnd > pageStart) {
      parts.push(`tr.${pageStart}–${pageEnd}`);
    } else if (pageStart != null) {
      parts.push(`tr.${pageStart}`);
    }
    return parts.join(', ');
  }

  /**
   * Citation quote: whole paragraph(s) containing keywords — never mid-sentence slice.
   */
  private extractQuote(content: string, keywords: string[]): string {
    const paragraphs = this.splitParagraphs(content);
    if (!paragraphs.length) return '';

    if (!keywords.length) {
      return this.joinCompleteParagraphs(paragraphs.slice(0, 2), QUOTE_MAX_CHARS);
    }

    const lowerKeys = keywords.map((k) => k.toLowerCase());
    let bestIdx = -1;
    let bestHits = -1;

    for (let i = 0; i < paragraphs.length; i++) {
      const lower = paragraphs[i].toLowerCase();
      // Skip page markers alone
      if (/^\[Trang\s+\d+\]\s*$/i.test(paragraphs[i].trim())) continue;
      let hits = 0;
      for (const k of lowerKeys) {
        if (lower.includes(k)) hits++;
      }
      if (hits > bestHits) {
        bestHits = hits;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) {
      return this.joinCompleteParagraphs(paragraphs.slice(0, 2), QUOTE_MAX_CHARS);
    }

    // Matched paragraph ±1 paragraph, and expand to full HỎI–ĐÁP when present.
    const start = Math.max(0, bestIdx - 1);
    const end = Math.min(paragraphs.length, bestIdx + 3);
    const window = paragraphs.slice(start, end);

    const withQa = this.expandToQaPair(paragraphs, bestIdx);
    const chosen =
      withQa.length > window.length
        ? withQa
        : this.mergeUniqueParagraphs(window, withQa);

    return this.joinCompleteParagraphs(chosen, QUOTE_MAX_CHARS);
  }

  private mergeUniqueParagraphs(a: string[], b: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of [...a, ...b]) {
      if (seen.has(p)) continue;
      seen.add(p);
      out.push(p);
    }
    return out;
  }

  private splitParagraphs(content: string): string[] {
    return content
      .split(PARAGRAPH_SPLIT)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  /** If index is HỎI or ĐÁP, include the paired lines as one unit. */
  private expandToQaPair(paragraphs: string[], index: number): string[] {
    const isHoi = (s: string) => /^\*{0,2}\d*\.?\s*HỎI\s*:/i.test(s.trim()) || /^Hỏi\s*:/i.test(s.trim());
    const isDap = (s: string) => /^[➤➢]?\s*\*{0,2}ĐÁP\s*:/i.test(s.trim()) || /^Đáp\s*:/i.test(s.trim());

    let start = index;
    let end = index;

    if (isDap(paragraphs[index]) && index > 0 && isHoi(paragraphs[index - 1])) {
      start = index - 1;
    }
    if (isHoi(paragraphs[index]) && index + 1 < paragraphs.length && isDap(paragraphs[index + 1])) {
      end = index + 1;
    }

    // Also merge consecutive lines that look like Q then A without blank split
    return paragraphs.slice(start, end + 1);
  }

  private joinCompleteParagraphs(parts: string[], maxChars: number): string {
    const out: string[] = [];
    let used = 0;
    for (const part of parts) {
      const next = used === 0 ? part : `${out.join('\n\n')}\n\n${part}`;
      if (next.length > maxChars && out.length > 0) break;
      out.push(part);
      used = out.join('\n\n').length;
      if (used >= maxChars) break;
    }
    return out.join('\n\n').trim();
  }

  /**
   * Trim context body at paragraph (preferred) or sentence boundary — never mid-clause.
   */
  private trimPassageAtSentence(content: string, maxChars: number): string {
    const normalized = content.trim();
    if (normalized.length <= maxChars) return normalized;

    const paragraphs = this.splitParagraphs(normalized);
    if (paragraphs.length > 1) {
      const joined = this.joinCompleteParagraphs(paragraphs, maxChars);
      if (joined.length >= Math.floor(maxChars * 0.4)) return joined;
    }

    const hardCut = normalized.slice(0, maxChars).trimEnd();

    for (let i = hardCut.length - 1; i >= 0; i--) {
      const ch = hardCut[i];
      if (!SENTENCE_ENDINGS.test(ch)) continue;
      if (i < Math.floor(maxChars * 0.55)) break;
      return hardCut.slice(0, i + 1).trimEnd();
    }

    const lookAhead = normalized.slice(
      maxChars,
      Math.min(normalized.length, maxChars + 400),
    );
    for (let i = 0; i < lookAhead.length; i++) {
      if (SENTENCE_ENDINGS.test(lookAhead[i])) {
        return normalized.slice(0, maxChars + i + 1).trimEnd();
      }
    }

    // Last resort: cut at last whitespace so we don't split a word.
    const sp = hardCut.lastIndexOf(' ');
    if (sp > Math.floor(maxChars * 0.5)) return hardCut.slice(0, sp).trimEnd();
    return hardCut;
  }
}
