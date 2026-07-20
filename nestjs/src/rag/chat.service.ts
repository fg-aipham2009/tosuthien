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
  ChatOptions,
  ChatTurn,
} from './rag.types';
import { RAG_DISCLAIMER, clampTopK, CANDIDATE_POOL, AI_INTERPRETATION_MARKER } from './rag.constants';
import {
  expandKeywords,
  questionStem,
  analyzeQuery,
  buildIntentBrief,
  resolvePrimarySourceFiles,
} from './rag-keywords.util';
import { isKinhSource, sourceTier, toPrintedPage, printedPageOffset } from './rag-source.util';
import { normalizeHistory } from './llm.service';
import {
  maxPassageCharsForTier,
  resolveAnswerStyle,
  tierLabel,
  type AnswerStyle,
  type AnswerStyleContext,
} from './rag-answer-style';

/** Cap LLM context — neighbor ±1 pages need room for full paragraphs. */
const MAX_CONTEXT_CHARS = 36_000;
/** Soft cap for citation quote — prefer whole paragraphs under this size. */
const QUOTE_MAX_CHARS = 8_000;
const MAX_DISPLAY_CITATIONS = 24;
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

  async chat(question: string, options: ChatOptions = {}): Promise<ChatResult> {
    const totalStart = Date.now();
    const prepared = await this.prepareChat(question, options);
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

    const { answer, aiInterpretation } = this.enforceVerbatimAnswer(
      await this.llm.answer(
        prepared.q,
        blocks,
        prepared.styleContext,
        prepared.intentBrief,
        prepared.history,
      ),
      citations,
    );
    const llmMs = Date.now() - llmStart;

    const displayCitations = await this.citationsForAnswer(
      answer,
      citations.length ? citations : prepared.slimCitations,
      prepared.keywords,
      prepared.sourceHints,
    );

    return {
      answer,
      aiInterpretation,
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
    options: ChatOptions = {},
  ): AsyncGenerator<ChatStreamEvent> {
    const totalStart = Date.now();
    yield { type: 'status', phase: 'retrieving' };

    const prepared = await this.prepareChat(question, options);
    if (prepared.kind === 'empty') {
      const empty = this.emptyResult({
        ...prepared.meta,
        totalMs: Date.now() - totalStart,
      });
      yield {
        type: 'done',
        answer: empty.answer,
        aiInterpretation: empty.aiInterpretation,
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
        aiInterpretation: empty.aiInterpretation,
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
      prepared.intentBrief,
      prepared.history,
    )) {
      parts.push(text);
      yield { type: 'delta', text };
    }

    const llmMs = Date.now() - llmStart;

    const { answer, aiInterpretation } = this.enforceVerbatimAnswer(
      parts.join('').trim(),
      citations,
    );
    const finalAnswer =
      answer ||
      'Trong tư liệu hiện có chưa tìm thấy đoạn liên quan. Hãy thử hỏi theo từ khóa khác.';
    const displayCitations = await this.citationsForAnswer(
      finalAnswer,
      citations.length ? citations : prepared.slimCitations,
      prepared.keywords,
      prepared.sourceHints,
    );
    yield {
      type: 'done',
      answer: finalAnswer,
      aiInterpretation,
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
    options: ChatOptions = {},
  ): Promise<
    | { kind: 'empty'; meta: ChatResult['meta'] }
    | {
        kind: 'ready';
        q: string;
        keywords: string[];
        sourceHints: string[];
        intentBrief: string;
        history: ChatTurn[];
        hits: PassageHit[];
        blocks: string[];
        slimCitations: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>[];
        styleContext: AnswerStyleContext;
        meta: ChatResult['meta'];
      }
  > {
    const q = question.trim();
    if (q.length < 2) throw new BadRequestException('Câu hỏi quá ngắn');

    const sourceFiles = this.normalizeSourceFiles(options.sourceFiles);
    const history = normalizeHistory(options.messages);
    const topK = options.topK;

    const { keywords, mustGroups, topicTerms, sourceHints } = analyzeQuery(
      q,
      STOP_WORDS,
    );
    let intentBrief = buildIntentBrief({
      keywords,
      mustGroups,
      topicTerms,
      sourceHints,
    });
    if (sourceFiles.length) {
      intentBrief = [
        intentBrief,
        `Chỉ tra cứu trong sách: ${sourceFiles.join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
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
        this.searchPassagesFts(searchKeywords, CANDIDATE_POOL, sourceFiles),
        mustGroups.length >= 2
          ? this.searchPassagesCooccurrence(mustGroups, 15, sourceFiles)
          : Promise.resolve([] as PassageHit[]),
        this.searchPassagesKinhTier(kinhTerms, 22, sourceFiles),
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
          sourceFiles,
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

    const styleContextRaw = resolveAnswerStyle(rankedHits, relevanceOf);
    const styleContext =
      sourceHints.length && styleContextRaw.style === 'brief'
        ? { ...styleContextRaw, style: 'kinh_long' as const }
        : styleContextRaw;
    const primaryFiles = resolvePrimarySourceFiles(sourceHints);
    const hits = this.diversifyBySource(
      this.trimHitsForStyle(rankedHits, styleContext.style, relevanceOf),
      Math.max(k, 8),
      primaryFiles,
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
      sourceFiles: sourceFiles.length ? sourceFiles : undefined,
      historyTurns: history.length,
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
      intentBrief,
      history,
      hits,
      blocks,
      slimCitations,
      styleContext,
      meta,
    };
  }

  /** Normalize client sourceFiles to existing `N.txt` stems. */
  private normalizeSourceFiles(raw?: string[] | null): string[] {
    if (!raw?.length) return [];
    const out = new Set<string>();
    for (const item of raw) {
      const name = (item ?? '').trim().toLowerCase();
      if (!name) continue;
      const base = name.split(/[/\\]/).pop() ?? name;
      const file = base.endsWith('.txt') || base.endsWith('.pdf')
        ? base.replace(/\.pdf$/i, '.txt')
        : `${base}.txt`;
      if (/^\d{1,2}\.txt$/.test(file)) out.add(file);
    }
    return [...out].sort((a, b) => Number(a.replace('.txt', '')) - Number(b.replace('.txt', '')));
  }

  private sourceFilterSql(sourceFiles: string[]): Prisma.Sql {
    if (!sourceFiles.length) return Prisma.empty;
    return Prisma.sql`AND r.source_file IN (${Prisma.join(
      sourceFiles.map((f) => Prisma.sql`${f}`),
    )})`;
  }

  private emptyResult(meta: ChatResult['meta']): ChatResult {
    return {
      answer:
        'Trong tư liệu hiện có chưa tìm thấy đoạn liên quan. Hãy thử hỏi theo từ khóa khác.',
      aiInterpretation: null,
      disclaimer: RAG_DISCLAIMER,
      citations: [],
      meta,
    };
  }

  /**
   * Prefer citations that appear as `— (Title, tr.X)` in the answer so UI
   * chips match every em-dash source the model quoted.
   */
  private async citationsForAnswer(
    answer: string,
    pool: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>[],
    keywords: string[],
    sourceHints: string[],
  ): Promise<ChatCitation[]> {
    const refs = this.parseAnswerCitationRefs(answer);
    if (!refs.length || !pool.length) {
      return this.prepareDisplayCitations(pool, keywords, sourceHints);
    }

    const selected: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>[] = [];
    const usedKeys = new Set<string>();

    for (const ref of refs) {
      if (selected.length >= MAX_DISPLAY_CITATIONS) break;
      const match = this.matchCitationRef(ref, pool);
      if (!match) continue;
      const page = ref.page ?? match.pageNum ?? match.pageStart ?? null;
      const key = `${(match.sourceFile || match.title).toLowerCase()}::${page ?? 'x'}`;
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);

      const pages =
        page != null
          ? [page]
          : match.pages?.length
            ? match.pages
            : [];
      selected.push({
        ...match,
        pageNum: page,
        pageStart: page ?? match.pageStart,
        pageEnd: page ?? match.pageEnd,
        pages,
        label: this.formatLabel(match.title, match.volume, page, page),
        quote: ref.quote?.trim() || match.quote,
      });
    }

    if (!selected.length) {
      return this.prepareDisplayCitations(pool, keywords, sourceHints);
    }

    // Fill remaining slots from ranked pool (other books), without dropping
    // answer-aligned ones when sourceHints would have filtered them.
    if (selected.length < MAX_DISPLAY_CITATIONS) {
      const fallback = await this.prepareDisplayCitations(
        pool,
        keywords,
        sourceHints,
      );
      const slimFallback = fallback.map(
        ({ pdf: _p, openLabel: _o, pageLinks: _l, ...rest }) => rest,
      );
      for (const c of slimFallback) {
        if (selected.length >= MAX_DISPLAY_CITATIONS) break;
        const page = c.pageNum ?? c.pageStart ?? null;
        const key = `${(c.sourceFile || c.title).toLowerCase()}::${page ?? 'x'}`;
        if (usedKeys.has(key)) continue;
        usedKeys.add(key);
        selected.push(c);
      }
    }

    return this.citationLinks.enrichCitations(selected);
  }

  /** Parse `— (Book Title, tr.16)` (and optional preceding "quote") from answer. */
  private parseAnswerCitationRefs(answer: string): Array<{
    titleHint: string;
    page: number | null;
    quote: string | null;
  }> {
    const refs: Array<{
      titleHint: string;
      page: number | null;
      quote: string | null;
    }> = [];
    const seen = new Set<string>();

    const push = (inside: string, quote: string | null) => {
      const parsed = this.parseCitationLabelInside(inside);
      if (!parsed.titleHint) return;
      const key = `${parsed.titleHint.toLowerCase()}::${parsed.page ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      refs.push({ ...parsed, quote });
    };

    const pairRe = /"([^"]{15,})"\s*[—–-]\s*\(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = pairRe.exec(answer)) !== null) {
      push(m[2], m[1]);
    }

    const bareRe = /[—–-]\s*\(([^)]+)\)/g;
    while ((m = bareRe.exec(answer)) !== null) {
      push(m[1], null);
    }

    return refs;
  }

  private parseCitationLabelInside(inside: string): {
    titleHint: string;
    page: number | null;
  } {
    const raw = inside.replace(/\s+/g, ' ').trim();
    const pageM = raw.match(/,\s*tr\.\s*(\d+)(?:\s*[–-]\s*\d+)?\s*$/i);
    if (!pageM || pageM.index == null) {
      return { titleHint: raw, page: null };
    }
    return {
      titleHint: raw.slice(0, pageM.index).replace(/,\s*$/, '').trim(),
      page: Number(pageM[1]),
    };
  }

  private matchCitationRef(
    ref: { titleHint: string; page: number | null },
    pool: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>[],
  ): Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'> | null {
    const hint = this.normalizeTitleKey(ref.titleHint);
    if (!hint) return null;

    const scored = pool
      .map((c) => {
        const title = this.normalizeTitleKey(c.title);
        const label = this.normalizeTitleKey(c.label);
        let score = 0;
        if (title === hint || label.startsWith(hint)) score += 8;
        else if (title.includes(hint) || hint.includes(title)) score += 5;
        else if (label.includes(hint)) score += 3;
        else return null;

        if (ref.page != null) {
          const pages = new Set<number>([
            ...(c.pages ?? []),
            ...(c.pageNum != null ? [c.pageNum] : []),
            ...(c.pageStart != null ? [c.pageStart] : []),
            ...(c.pageEnd != null ? [c.pageEnd] : []),
          ]);
          if (pages.has(ref.page)) score += 6;
          else if (
            c.pageStart != null &&
            c.pageEnd != null &&
            ref.page >= c.pageStart &&
            ref.page <= c.pageEnd
          ) {
            score += 4;
          } else {
            score -= 1;
          }
        }
        return { c, score };
      })
      .filter((x): x is { c: (typeof pool)[number]; score: number } => !!x)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.c ?? null;
  }

  private normalizeTitleKey(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async prepareDisplayCitations(
    citations: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>[],
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
      resolvePrimarySourceFiles(sourceHints),
    );

    return this.citationLinks.enrichCitations(diversified);
  }

  /**
   * Round-robin across source files so citations aren't dominated by one book.
   */
  private diversifyCitationsBySource(
    citations: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>[],
    limit: number,
    primaryFiles: string[] = [],
  ): Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>[] {
    const ranked = this.dedupeCitationsBySourcePage(citations);
    const primary = new Set(primaryFiles.map((f) => f.toLowerCase()));
    const out: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>[] = [];
    const seen = new Set<string>();

    const push = (c: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>) => {
      const key = (c.sourceFile || c.title || 'unknown').toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(c);
    };

    for (const c of ranked) {
      if (out.length >= limit) break;
      if (primary.has((c.sourceFile || '').toLowerCase())) push(c);
    }
    for (const c of ranked) {
      if (out.length >= limit) break;
      push(c);
    }
    return out;
  }

  private dedupeCitationsBySourcePage(
    citations: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>[],
  ): Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>[] {
    const best = new Map<string, Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>>();
    for (const c of citations) {
      const page = c.pageNum ?? -1;
      const key = `${c.sourceFile || c.title || 'unknown'}::${page}`;
      const prev = best.get(key);
      if (!prev || Number(c.score) > Number(prev.score)) {
        best.set(key, c);
      }
    }
    const keep = new Set(best.values());
    return citations.filter((c) => keep.has(c));
  }

  /**
   * Prefer different books; pin named-book (primaryFiles) first with up to 2 pages.
   */
  private diversifyBySource(
    hits: PassageHit[],
    limit: number,
    primaryFiles: string[] = [],
  ): PassageHit[] {
    if (hits.length <= 1) return hits;

    const deduped = this.dedupeHitsBySourcePage(hits);
    const primary = new Set(primaryFiles.map((f) => f.toLowerCase()));
    const out: PassageHit[] = [];
    const countBySource = new Map<string, number>();

    const tryPush = (h: PassageHit, maxPerSource: number) => {
      const key = (h.sourceFile || h.title || 'unknown').toLowerCase();
      const n = countBySource.get(key) ?? 0;
      if (n >= maxPerSource) return false;
      if (
        n > 0
        && h.pageNum != null
        && out.some(
          (x) =>
            (x.sourceFile || '').toLowerCase() === key
            && x.pageNum != null
            && Math.abs(x.pageNum - h.pageNum!) <= 1,
        )
      ) {
        return false;
      }
      countBySource.set(key, n + 1);
      out.push(h);
      return true;
    };

    // 1) Named kinh/sách first (allow 2 non-adjacent pages for full đầu–đuôi).
    for (const h of deduped) {
      if (out.length >= limit) break;
      const key = (h.sourceFile || '').toLowerCase();
      if (!primary.has(key)) continue;
      tryPush(h, 2);
    }

    // 2) Fill with other books (1 each).
    for (const h of deduped) {
      if (out.length >= limit) break;
      const key = (h.sourceFile || '').toLowerCase();
      if (primary.has(key)) continue;
      tryPush(h, 1);
    }

    // 3) If still short, allow more from primary.
    for (const h of deduped) {
      if (out.length >= limit) break;
      tryPush(h, primary.has((h.sourceFile || '').toLowerCase()) ? 3 : 1);
    }

    return out;
  }

  /** Keep the best-scoring hit per (sourceFile, pageNum). */
  private dedupeHitsBySourcePage(hits: PassageHit[]): PassageHit[] {
    const best = new Map<string, PassageHit>();
    for (const h of hits) {
      const page = h.pageNum ?? -1;
      const key = `${h.sourceFile || h.title || 'unknown'}::${page}`;
      const prev = best.get(key);
      if (!prev || Number(h.score) > Number(prev.score)) {
        best.set(key, h);
      }
    }
    const keep = new Set(best.values());
    return hits.filter((h) => keep.has(h));
  }

  private citationRank(
    c: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>,
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
    c: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>,
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
    sourceFiles: string[] = [],
  ): Promise<PassageHit[]> {
    if (!mustGroups.length) return [];

    const groupConds = mustGroups.map((group) => {
      const ors = group.map(
        (term) => Prisma.sql`p.content ILIKE ${'%' + term + '%'}`,
      );
      return Prisma.sql`(${Prisma.join(ors, ' OR ')})`;
    });
    const where = Prisma.join(groupConds, ' AND ');
    const sourceSql = this.sourceFilterSql(sourceFiles);

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
        ${sourceSql}
      ORDER BY length(p.content) ASC, p.page_num NULLS LAST
      LIMIT ${limit}
    `;

    return rows.map((r) => ({ ...r, score: Number(r.score) }));
  }

  /** Kinh / nguyên tác (exclude HT Duy Lực Ngữ Lục) matching topic terms. */
  private async searchPassagesKinhTier(
    terms: string[],
    limit: number,
    sourceFiles: string[] = [],
  ): Promise<PassageHit[]> {
    const unique = [
      ...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2)),
    ].slice(0, 10);
    if (!unique.length) return [];

    const topicOrs = unique.map(
      (t) => Prisma.sql`p.content ILIKE ${'%' + t + '%'}`,
    );
    const sourceSql = this.sourceFilterSql(sourceFiles);

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
        ${sourceSql}
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

  private async searchPassagesVector(
    vector: number[],
    limit: number,
    sourceFiles: string[] = [],
  ): Promise<PassageHit[]> {
    const literal = this.embedding.toVectorLiteral(vector);

    if (sourceFiles.length) {
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
        WHERE r.source_file = ANY($3::text[])
        ORDER BY e.embedding <=> $1::vector
        LIMIT $2
        `,
        literal,
        limit,
        sourceFiles,
      )) as PassageHit[];
      return rows.map((r) => ({ ...r, score: Number(r.score) }));
    }

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
    sourceFiles: string[] = [],
  ): Promise<PassageHit[]> {
    if (!keywords.length) return [];

    const ftsQuery = keywords.join(' ');
    const rowsById = new Map<string, PassageHit>();

    // Gộp kết quả FTS + ILIKE (AND rồi OR) để tăng recall, khử trùng theo passageId
    const merge = (rows: PassageHit[]) => {
      for (const r of rows) if (!rowsById.has(r.passageId)) rowsById.set(r.passageId, r);
    };

    merge(await this.runFtsQuery(ftsQuery, limit, sourceFiles));
    if (keywords.length >= 2) {
      merge(await this.runIlikeQuery(keywords, limit, true, sourceFiles));
    }
    merge(await this.runIlikeQuery(keywords, limit, false, sourceFiles));

    return this.rankByKeywordHits([...rowsById.values()], keywords).slice(0, limit);
  }

  private runFtsQuery(
    query: string,
    limit: number,
    sourceFiles: string[] = [],
  ): Promise<PassageHit[]> {
    const sourceSql = this.sourceFilterSql(sourceFiles);
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
        ${sourceSql}
      ORDER BY score DESC, p.page_num NULLS LAST
      LIMIT ${limit}
    `;
  }

  private runIlikeQuery(
    keywords: string[],
    limit: number,
    requireAll: boolean,
    sourceFiles: string[] = [],
  ): Promise<PassageHit[]> {
    const conditions = keywords.map(
      (k) => Prisma.sql`p.content ILIKE ${'%' + k + '%'}`,
    );
    const where = requireAll
      ? Prisma.join(conditions, ' AND ')
      : Prisma.join(conditions, ' OR ');
    const sourceSql = this.sourceFilterSql(sourceFiles);

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
        ${sourceSql}
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

    if (this.matchesSourceHints(h, sourceHints)) rank += 2.4;

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
   * Expand each hit with neighboring OCR pages (±2) from the same source file.
   * Page-turn narratives (e.g. Pháp Bảo Đàn tr.14→15) need the lead-in on the prior page.
   */
  private async expandHitsWithNeighborPages(
    hits: PassageHit[],
  ): Promise<PassageHit[]> {
    return Promise.all(
      hits.map(async (hit) => {
        if (hit.pageNum == null) return hit;

        const center = hit.pageNum;
        const radius = 2;
        const pageStart = Math.max(1, center - radius);
        const pageEnd = center + radius;
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

        // Neighbor window is only for LLM context. Cite/open the hit page itself.
        return {
          ...hit,
          content: mergedParts.join('\n\n'),
          pageNum: center,
          pageStart: center,
          pageEnd: center,
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
    const citations: Omit<ChatCitation, 'pdf' | 'openLabel' | 'pageLinks'>[] = [];
    const blocks: string[] = [];
    let used = 0;

    for (let i = 0; i < hits.length; i++) {
      const h = hits[i] as PassageHit & {
        pageStart?: number;
        pageEnd?: number;
      };
      // Hits store OCR/file pages; expose printed page of the HIT (not neighbor window).
      const ocrPage = h.pageNum ?? h.pageStart ?? h.pageEnd;
      const printedPage = toPrintedPage(h.sourceFile, ocrPage);
      const tier = sourceTier(h.title, h.sourceFile);
      const headerLabel = this.formatLabel(
        h.title,
        h.volume,
        printedPage,
        printedPage,
      );
      const header = `[${tierLabel(tier)}]\nTrích dẫn: ${headerLabel}`;

      const maxChars = maxPassageCharsForTier(tier);
      // Neighbor windows are larger — allow more chars so 3 pages aren't truncated away.
      const pageMarkers = (h.content.match(/\[Trang\s+\d+\]/g) ?? []).length;
      const windowBonus =
        pageMarkers > 1 ? Math.min(12_000, (pageMarkers - 1) * 2_800) : 0;
      const body = this.trimPassageAtSentence(h.content, maxChars + windowBonus);
      const block = `${header}\n${body}`;
      if (used + block.length > MAX_CONTEXT_CHARS) break;

      blocks.push(block);
      used += block.length;

      const quote = this.extractQuote(body, keywords);
      const pageSections = this.splitContentByPrintedPage(body);
      const pages =
        pageSections.length > 0
          ? pageSections.map((s) => s.page)
          : printedPage != null
            ? [printedPage]
            : [];
      const windowStart = pages.length ? pages[0] : printedPage;
      const windowEnd = pages.length ? pages[pages.length - 1] : printedPage;

      // One citation card per source hit; page chips open each page in the window.
      citations.push({
        passageId: h.passageId,
        label: this.formatLabel(h.title, h.volume, windowStart, windowEnd),
        title: h.title,
        volume: h.volume,
        pageNum: printedPage ?? windowStart ?? null,
        pageStart: windowStart ?? null,
        pageEnd: windowEnd ?? null,
        pages,
        sourceFile: h.sourceFile,
        score: Math.round(h.score * 1000) / 1000,
        quote,
        excerpt: body,
      });
    }

    return { blocks, citations };
  }

  /** Split expanded body marked with [Trang N] into per-page excerpts. */
  private splitContentByPrintedPage(
    content: string,
  ): Array<{ page: number; body: string }> {
    const chunks = content.split(/(?=\[Trang\s+\d+\])/i);
    const out: Array<{ page: number; body: string }> = [];
    for (const chunk of chunks) {
      const m = chunk.match(/^\[Trang\s+(\d+)\]\s*/i);
      if (!m) continue;
      const body = chunk.slice(m[0].length).trim();
      if (!body) continue;
      out.push({ page: Number(m[1]), body });
    }
    return out;
  }

  private formatLabel(
    title: string,
    volume: string | null,
    pageStart: number | null | undefined,
    pageEnd?: number | null,
  ): string {
    const parts = [title];
    const vol = volume?.trim();
    // Avoid "… — QUYỂN THƯỢNG, QUYỂN THƯỢNG" when title already includes volume.
    if (
      vol &&
      !title.toLocaleLowerCase('vi').includes(vol.toLocaleLowerCase('vi'))
    ) {
      parts.push(vol);
    }
    if (pageStart != null && pageEnd != null && pageEnd > pageStart) {
      parts.push(`tr.${pageStart}–${pageEnd}`);
    } else if (pageStart != null) {
      parts.push(`tr.${pageStart}`);
    }
    return parts.join(', ');
  }

  /**
   * Map leftover "Nguồn N" / "(Nguồn N)" in the answer to book title + page labels.
   */
  private rewriteNumericSourceRefs(
    answer: string,
    citations: Array<{ label: string }>,
  ): string {
    if (!answer || !citations.length) return answer;

    let out = answer.replace(
      /\(\s*[Nn]guồn\s*(\d+)\s*\)/g,
      (_match, numStr: string) => {
        const label = citations[Number(numStr) - 1]?.label?.trim();
        return label ? `(${label})` : _match;
      },
    );

    out = out.replace(/\b[Nn]guồn\s*(\d+)\b/g, (match, numStr: string) => {
      const label = citations[Number(numStr) - 1]?.label?.trim();
      return label ?? match;
    });

    return out;
  }

  /**
   * Split LLM output into scripture quotes (`answer`) and a separate
   * `aiInterpretation` field shown last in the client.
   */
  private enforceVerbatimAnswer(
    answer: string,
    citations: Array<{ label: string }>,
  ): { answer: string; aiInterpretation: string | null } {
    const rewritten = this.rewriteNumericSourceRefs(answer, citations);
    if (!rewritten.trim()) {
      return { answer: rewritten, aiInterpretation: null };
    }

    const { scripture, aiBody } = this.splitAiInterpretation(rewritten);
    const cleanedScripture = scripture.trim();

    // Prefer the model's long verbatim block when it already looks correct —
    // re-extracting quotes can accidentally shorten passages.
    let scriptureOut: string;
    if (this.looksLikeLongVerbatim(cleanedScripture)) {
      scriptureOut = cleanedScripture;
    } else {
      scriptureOut =
        this.extractQuoteCitationPairs(cleanedScripture, citations) ||
        cleanedScripture ||
        rewritten.trim();
    }

    if (!aiBody?.trim()) {
      return { answer: scriptureOut, aiInterpretation: null };
    }

    const cleanedAi = this.cleanAiInterpretationTone(aiBody);

    return {
      answer: scriptureOut,
      aiInterpretation: cleanedAi || null,
    };
  }

  /** True when scripture already has long quotes + book citations (keep as-is). */
  private looksLikeLongVerbatim(scripture: string): boolean {
    if (!scripture) return false;
    const quoteMatches = scripture.match(/"([^"]{40,})"/g) ?? [];
    const citeMatches = scripture.match(/[—–-]\s*\([^)]+tr\.\s*\d+/gi) ?? [];
    const hasAiLeak =
      /phân tích|tóm lại|theo tôi|nguồn\s*\d+/i.test(scripture) &&
      quoteMatches.length === 0;
    if (hasAiLeak) return false;
    return quoteMatches.length >= 1 && citeMatches.length >= 1;
  }

  /** Strip stiff meta openers so the AI section reads naturally. */
  private cleanAiInterpretationTone(raw: string): string {
    let text = raw.trim();
    const leadPatterns = [
      /^\s*Đây là diễn giải của AI[^\n:]*:\s*/i,
      /^\s*Diễn giải của AI[^\n:]*:\s*/i,
      /^\s*Dựa vào (các )?đoạn trích( dẫn)?[^\n:]*:\s*/i,
      /^\s*Dựa trên (các )?đoạn trích( dẫn)?[^\n:]*:\s*/i,
      /^\s*Theo (các )?đoạn (trích|trên)[^\n:]*:\s*/i,
      /^\s*Theo câu hỏi và[^\n:]*:\s*/i,
      /^\s*Dựa vào câu hỏi và[^\n:]*:\s*/i,
    ];
    for (const re of leadPatterns) {
      text = text.replace(re, '');
    }
    // Soften leftover meta phrases mid-text (first sentence only).
    text = text.replace(
      /^(Dựa vào|Dựa trên|Theo)\s+(các\s+)?đoạn\s+trích[^.。]*[.。]\s*/i,
      '',
    );
    return text.trim();
  }

  private splitAiInterpretation(text: string): {
    scripture: string;
    aiBody: string | null;
  } {
    const markers = [
      AI_INTERPRETATION_MARKER,
      '【AI diễn giải】',
      '[AI diễn giải]',
      'AI diễn giải:',
    ];
    let idx = -1;
    let markerLen = 0;
    for (const m of markers) {
      const i = text.indexOf(m);
      if (i >= 0 && (idx < 0 || i < idx)) {
        idx = i;
        markerLen = m.length;
      }
    }
    if (idx < 0) return { scripture: text, aiBody: null };
    return {
      scripture: text.slice(0, idx).trim(),
      aiBody: text.slice(idx + markerLen).trim(),
    };
  }

  private extractQuoteCitationPairs(
    scripture: string,
    citations: Array<{ label: string }>,
  ): string | null {
    const labels = citations
      .map((c) => c.label?.trim())
      .filter((l): l is string => !!l);

    const pairs: string[] = [];
    const seen = new Set<string>();
    const quoteRe = /"([^"]{12,})"/g;
    let match: RegExpExecArray | null;

    while ((match = quoteRe.exec(scripture)) !== null) {
      // Preserve paragraph breaks; only tidy spaces inside lines.
      const quote = match[1]
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
      if (quote.length < 12) continue;

      const before = scripture.slice(Math.max(0, match.index - 160), match.index);
      const after = scripture.slice(
        match.index + match[0].length,
        match.index + match[0].length + 120,
      );

      let label =
        this.findLabelNear(before, labels) ??
        this.findLabelNear(after, labels) ??
        this.findLabelInEmDash(after, labels);

      if (!label && labels.length === 1) label = labels[0];
      if (!label) continue;

      const key = `${label}::${quote.slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(`"${quote}"\n— (${label})`);
    }

    return pairs.length > 0 ? pairs.join('\n\n') : null;
  }

  private findLabelNear(window: string, labels: string[]): string | null {
    let best: string | null = null;
    let bestPos = -1;
    for (const label of labels) {
      const pos = window.lastIndexOf(label);
      if (pos > bestPos) {
        bestPos = pos;
        best = label;
      }
    }
    return best;
  }

  private findLabelInEmDash(after: string, labels: string[]): string | null {
    const m = after.match(/^[^\S\n]*[—–-]\s*\(([^)]+)\)/);
    if (!m) return null;
    const inner = m[1].trim();
    return labels.find((l) => l === inner) ?? inner;
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

    // Wider window so citation chips show đủ đầu–đuôi (cross-page narratives).
    const start = Math.max(0, bestIdx - 3);
    const end = Math.min(paragraphs.length, bestIdx + 6);
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
