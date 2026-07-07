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
import { PassageHit, ChatResult, ChatCitation } from './rag.types';
import { RAG_DISCLAIMER, clampTopK, CANDIDATE_POOL } from './rag.constants';
import { expandKeywords, questionStem, analyzeQuery } from './rag-keywords.util';
import { isKinhSource, sourceTier } from './rag-source.util';
import {
  maxPassageCharsForTier,
  resolveAnswerStyle,
  tierLabel,
  type AnswerStyle,
} from './rag-answer-style';

const MAX_CONTEXT_CHARS = 32_000;
const EXCERPT_LEN = 800;
const QUOTE_LEN = 680;
const MAX_DISPLAY_CITATIONS = 8;
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
    const q = question.trim();
    if (q.length < 2) throw new BadRequestException('Câu hỏi quá ngắn');

    const { keywords, mustGroups, topicTerms, sourceHints } = analyzeQuery(q, STOP_WORDS);
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
      this.relevanceScore(h, keywords, searchKeywords, stem, mustGroups, sourceHints);

    const styleContext = resolveAnswerStyle(rankedHits, relevanceOf);
    const hits = this.trimHitsForStyle(rankedHits, styleContext.style, relevanceOf);

    const chatProvider = this.ai.get().chatProvider;

    const meta: ChatResult['meta'] = {
      topK: topK ?? k,
      topKResolved: k,
      embeddingCount,
      searchMode,
      retrievalMs,
      embedError,
      answerStyle: styleContext.style,
      chatProvider,
    };

    if (!hits.length) {
      return this.emptyResult({ ...meta, totalMs: Date.now() - totalStart });
    }

    const { blocks, citations } = this.buildContext(hits, keywords);
    if (!blocks.length) {
      return this.emptyResult({ ...meta, totalMs: Date.now() - totalStart });
    }

    const llmStart = Date.now();
    const answer = await this.llm.answer(q, blocks, styleContext);
    const llmMs = Date.now() - llmStart;
    const displayCitations = this.prepareDisplayCitations(
      citations,
      keywords,
      sourceHints,
    );

    return {
      answer,
      disclaimer: RAG_DISCLAIMER,
      citations: displayCitations,
      meta: { ...meta, llmMs, totalMs: Date.now() - totalStart },
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

  private prepareDisplayCitations(
    citations: Omit<ChatCitation, 'pdf' | 'openLabel'>[],
    keywords: string[],
    sourceHints: string[],
  ): ChatCitation[] {
    const ranked = [...citations]
      .filter((c) => this.isRelevantCitation(c, keywords, sourceHints))
      .sort((a, b) => this.citationRank(b, keywords) - this.citationRank(a, keywords))
      .slice(0, MAX_DISPLAY_CITATIONS);

    return ranked.map((c) => this.citationLinks.enrichCitation(c));
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
      if (kinh.length) return kinh;
      return hits;
    }

    if (style === 'brief') {
      const strong = hits.filter((h) => relevanceOf(h) >= MIN_RELEVANCE_SCORE + 1);
      const pool = strong.length ? strong : hits;
      return pool.slice(0, Math.min(4, pool.length));
    }

    // mixed: keep several kinh blocks + at most two strong ngu luc blocks
    const kinh = hits.filter((h) => isKinhSource(h.title, h.sourceFile));
    const nguLuc = hits
      .filter((h) => !isKinhSource(h.title, h.sourceFile))
      .filter((h) => relevanceOf(h) >= MIN_RELEVANCE_SCORE + 1)
      .slice(0, 2);
    return [...kinh.slice(0, 5), ...nguLuc];
  }

  private buildContext(hits: PassageHit[], keywords: string[]) {
    const citations: Omit<ChatCitation, 'pdf' | 'openLabel'>[] = [];
    const blocks: string[] = [];
    let used = 0;

    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      const tier = sourceTier(h.title, h.sourceFile);
      const label = this.formatLabel(h.title, h.volume, h.pageNum);
      const header = `[Nguồn ${i + 1} | ${tierLabel(tier)}] ${label} (${h.sourceFile})`;

      const maxChars = maxPassageCharsForTier(tier);
      const body = h.content.trim().slice(0, maxChars);
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
        pageNum: h.pageNum,
        sourceFile: h.sourceFile,
        score: Math.round(h.score * 1000) / 1000,
        quote,
        excerpt:
          body.length > EXCERPT_LEN ? `${body.slice(0, EXCERPT_LEN)}…` : body,
      });
    }

    return { blocks, citations };
  }

  private formatLabel(
    title: string,
    volume: string | null,
    pageNum: number | null,
  ): string {
    const parts = [title];
    if (volume) parts.push(volume);
    if (pageNum != null) parts.push(`tr.${pageNum}`);
    return parts.join(', ');
  }

  private extractQuote(content: string, keywords: string[]): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    const lower = normalized.toLowerCase();
    let bestIdx = -1;
    let bestKey = '';

    for (const k of keywords) {
      const idx = lower.indexOf(k);
      if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) {
        bestIdx = idx;
        bestKey = k;
      }
    }

    if (bestIdx < 0) {
      return normalized.length > QUOTE_LEN
        ? `${normalized.slice(0, QUOTE_LEN)}…`
        : normalized;
    }

    const start = Math.max(0, bestIdx - 250);
    const end = Math.min(normalized.length, bestIdx + bestKey.length + 550);
    let quote = normalized.slice(start, end).trim();
    if (start > 0) quote = `…${quote}`;
    if (end < normalized.length) quote = `${quote}…`;
    return quote;
  }
}
