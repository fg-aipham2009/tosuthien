import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AI_INTERPRETATION_MARKER } from '../rag.constants';
import { LlmService } from '../llm.service';
import type { ChatOptions, ChatStreamEvent } from '../rag.types';
import { routeCbetaQuery } from './cbeta-router';
import { CbetaCollectionsService } from './cbeta-collections.service';
import { CbetaDbService } from './cbeta-db.service';
import { CbetaEntitiesService } from './cbeta-entities.service';
import { enrichCbetaSearchZh } from './cbeta-preprocess.util';
import {
  cbetaAnswerLangBrief,
  cbetaEmptyHitMessage,
  detectCbetaAnswerLang,
  isCbetaBriefQuestion,
} from './cbeta-intent.util';
import { parseCbetaCitationHints } from './cbeta-query-parse.util';
import { CbetaRetrieveService } from './cbeta-retrieve.service';
import type {
  CbetaCitation,
  CbetaChunkHit,
  CbetaQueryRewrite,
  CbetaRetrieveResult,
  CbetaRouteDecision,
} from './cbeta.types';
import type { ChatTurn } from '../rag.types';

@Injectable()
export class CbetaChatService {
  constructor(
    private readonly db: CbetaDbService,
    private readonly collections: CbetaCollectionsService,
    private readonly retrieve: CbetaRetrieveService,
    private readonly entities: CbetaEntitiesService,
    private readonly llm: LlmService,
  ) {}

  assertCanChat(question: string) {
    if (!question?.trim()) {
      throw new BadRequestException('question required');
    }
    if (!this.db.isConfigured()) {
      throw new ServiceUnavailableException('CBETA_DATABASE_URL chưa cấu hình');
    }
  }

  /** Preview route + VN→Hán rewrite (no retrieve / no answer LLM). */
  async route(
    question: string,
    options: ChatOptions = {},
  ): Promise<CbetaRouteDecision & { queryRewrite: CbetaQueryRewrite }> {
    const rewrite = await this.prepareSearchQuery(question, options.messages);
    const decision = this.applyCitationHints(
      await this.routeDecision(question, rewrite.searchZh, options),
      question,
    );
    return { ...decision, queryRewrite: rewrite };
  }

  async chat(question: string, options: ChatOptions = {}) {
    this.assertCanChat(question);
    const t0 = Date.now();
    const rewrite = await this.prepareSearchQuery(question, options.messages);
    const decisionMerged = this.applyCitationHints(
      await this.routeDecision(question, rewrite.searchZh, options),
      question,
    );
    const retrieval = await this.runRetrieve(
      rewrite.searchZh,
      decisionMerged,
      options.topK,
      undefined,
      rewrite.keywords,
    );
    const { blocks, used, citations } = this.pack(retrieval, decisionMerged);
    const retrievalMs = Date.now() - t0;

    if (!blocks.length && !retrieval.entities?.length) {
      return {
        answer: cbetaEmptyHitMessage(question),
        aiInterpretation: '',
        citations: [],
        entities: [],
        meta: {
          ...this.metaBase(
            decisionMerged,
            retrieval,
            retrievalMs,
            Date.now() - t0,
            0,
            rewrite,
          ),
        },
      };
    }

    const intentBrief = this.intentBrief(
      question,
      decisionMerged,
      retrieval,
      rewrite,
    );
    const tLlm = Date.now();
    const raw = await this.llm.answerCbeta(
      question,
      blocks.length
        ? blocks
        : ['[CBETA] (chỉ có danh sách entity, không có đoạn trích)'],
      intentBrief,
      options.messages,
    );
    const llmMs = Date.now() - tLlm;
    const { answer, aiInterpretation } = this.splitAnswer(raw);

    return {
      answer,
      aiInterpretation,
      citations: this.toUiCitations(citations),
      entities: retrieval.entities ?? [],
      meta: {
        ...this.metaBase(
          decisionMerged,
          retrieval,
          retrievalMs,
          Date.now() - t0,
          used.length,
          rewrite,
        ),
        llmMs,
      },
    };
  }

  async *chatStream(
    question: string,
    options: ChatOptions = {},
  ): AsyncGenerator<ChatStreamEvent> {
    this.assertCanChat(question);
    const t0 = Date.now();

    yield {
      type: 'status',
      phase: 'retrieving',
      message: 'Đang chuẩn hóa câu hỏi → Hán (hhtech)…',
    };
    const rewrite = await this.prepareSearchQuery(question, options.messages);
    const decisionMerged = this.applyCitationHints(
      await this.routeDecision(question, rewrite.searchZh, options),
      question,
    );

    const retrieveMsg = decisionMerged.coverageMode
      ? 'Đang quét coverage (theo work khớp cấu hình title)…'
      : rewrite.skipped && rewrite.reason === 'rewrite_failed'
        ? 'Chuẩn hóa Hán chậm/lỗi — đang tra CBETA bằng câu gốc…'
        : rewrite.skipped
          ? 'Đang tra cứu CBETA…'
          : `Đang tra CBETA: ${rewrite.searchZh}`;
    yield {
      type: 'status',
      phase: 'retrieving',
      message: retrieveMsg,
    };

    const retrieval = await this.runRetrieve(
      rewrite.searchZh,
      decisionMerged,
      options.topK,
      (p) => {
        void p;
      },
      rewrite.keywords,
    );

    const { blocks, used, citations } = this.pack(retrieval, decisionMerged);

    // UI citations are labels + CBETA Online links only — omit full Hán text
    // (LLM still gets full blocks). Huge quote payloads stall SSE / browsers.
    const uiCitations = this.toUiCitations(citations);

    yield {
      type: 'meta',
      meta: {
        corpus: 'cbeta',
        path: decisionMerged.path,
        route: decisionMerged,
        searchMode: retrieval.searchMode,
        embedError: retrieval.embedError,
        retrievalMs: Date.now() - t0,
        hitCount: used.length,
        entityCount: retrieval.entities?.length ?? 0,
        worksScanned: retrieval.worksScanned ?? [],
        passes: retrieval.passes,
        citationPolicy: 'required',
        queryRewrite: rewrite,
      },
    };

    if (!blocks.length && !retrieval.entities?.length) {
      const msg = cbetaEmptyHitMessage(question);
      yield { type: 'citations', citations: [] };
      yield { type: 'delta', text: msg };
      yield {
        type: 'done',
        answer: msg,
        aiInterpretation: '',
        citations: [],
        meta: {
          corpus: 'cbeta',
          path: decisionMerged.path,
          totalMs: Date.now() - t0,
          queryRewrite: rewrite,
        },
      };
      return;
    }

    // Emit generating before citations so the client leaves "retrieving"
    // while the LLM request is in flight (citations are small now, but
    // TTFT can still be tens of seconds).
    yield { type: 'status', phase: 'generating' };
    yield { type: 'citations', citations: uiCitations };

    const intentBrief = this.intentBrief(
      question,
      decisionMerged,
      retrieval,
      rewrite,
    );
    const parts: string[] = [];
    for await (const delta of this.llm.answerCbetaStream(
      question,
      blocks.length ? blocks : ['[CBETA] (chỉ có danh sách entity)'],
      intentBrief,
      options.messages,
    )) {
      parts.push(delta);
      yield { type: 'delta', text: delta };
    }
    const raw = parts.join('');
    const { answer, aiInterpretation } = this.splitAnswer(raw);
    yield {
      type: 'done',
      answer,
      aiInterpretation,
      citations: uiCitations,
      meta: {
        corpus: 'cbeta',
        path: decisionMerged.path,
        entities: retrieval.entities ?? [],
        worksScanned: retrieval.worksScanned ?? [],
        totalMs: Date.now() - t0,
        queryRewrite: rewrite,
      },
    };
  }

  private async routeDecision(
    question: string,
    searchZh: string,
    options: ChatOptions,
  ): Promise<CbetaRouteDecision> {
    const aliases = await this.collections.listRouteAliases();
    const decision = routeCbetaQuery({
      question,
      corpus: 'cbeta',
      collections: options.cbetaCollections,
      forcePath: options.cbetaPath,
      aliases,
    });
    return this.mergeAliasFromSearch(decision, searchZh, options);
  }

  private async prepareSearchQuery(
    question: string,
    history?: ChatTurn[],
  ): Promise<CbetaQueryRewrite> {
    const t0 = Date.now();
    const r = await this.llm.rewriteCbetaSearchQuery(question, history || []);
    const enriched = enrichCbetaSearchZh(
      question,
      r.searchZh || question,
      r.keywords || [],
    );
    const keywords = enriched.keywords;
    const searchZh =
      [enriched.searchZh, ...keywords]
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .filter((s, i, arr) => arr.indexOf(s) === i)
        .join(' ')
        .trim() || question.trim();
    return {
      searchZh,
      keywords,
      skipped: r.skipped,
      reason: r.reason,
      rewriteMs: Date.now() - t0,
    };
  }

  /** Hard SQL filters from explicit work_code / juan / page in the question. */
  private applyCitationHints(
    decision: CbetaRouteDecision,
    question: string,
  ): CbetaRouteDecision {
    const hints = parseCbetaCitationHints(question);
    if (
      !hints.workCodes.length &&
      hints.juanNo == null &&
      !hints.cbetaRefNeedle
    ) {
      return decision;
    }
    const seen = new Set(decision.workCodes);
    const workCodes = [...decision.workCodes];
    for (const w of hints.workCodes) {
      if (!seen.has(w)) {
        seen.add(w);
        workCodes.push(w);
      }
    }
    const juanNo = hints.juanNo ?? decision.juanNo;
    const cbetaRefNeedle = hints.cbetaRefNeedle ?? decision.cbetaRefNeedle;
    const scopeParts = [
      `path=${decision.path}`,
      decision.coverageMode ? 'mode=coverage' : null,
      decision.collections.length
        ? `collections=${decision.collections.join(',')}`
        : 'collections=none',
      workCodes.length ? `work_codes=${workCodes.join(',')}` : null,
      juanNo != null ? `juan=${juanNo}` : null,
      cbetaRefNeedle ? `ref~${cbetaRefNeedle}` : null,
    ].filter(Boolean);
    return {
      ...decision,
      workCodes,
      juanNo,
      cbetaRefNeedle,
      scopeNote: scopeParts.join('; '),
      reasons: [...decision.reasons, ...hints.reasons],
    };
  }

  /** Alias match on Hán rewrite only (path/coverage stay from original question). */
  private async mergeAliasFromSearch(
    decision: CbetaRouteDecision,
    searchZh: string,
    options: ChatOptions,
  ): Promise<CbetaRouteDecision> {
    if (!searchZh?.trim()) return decision;
    const aliases = await this.collections.listRouteAliases();
    const again = routeCbetaQuery({
      question: searchZh,
      corpus: 'cbeta',
      collections: options.cbetaCollections,
      forcePath: 'fast',
      aliases,
    });
    if (!again.collections.length) return decision;
    const merged = [...decision.collections];
    const seen = new Set(merged);
    const newAliasReasons: string[] = [];
    for (const c of again.collections) {
      if (!seen.has(c)) {
        seen.add(c);
        merged.push(c);
        newAliasReasons.push(`alias→${c}`);
      }
    }
    if (!newAliasReasons.length && merged.length === decision.collections.length) {
      return decision;
    }
    return {
      ...decision,
      collections: merged,
      scopeNote: [
        `path=${decision.path}`,
        decision.coverageMode ? 'mode=coverage' : null,
        merged.length ? `collections=${merged.join(',')}` : 'collections=none',
      ]
        .filter(Boolean)
        .join('; '),
      reasons: [...decision.reasons, ...newAliasReasons],
    };
  }

  private async runRetrieve(
    searchQuestion: string,
    decision: CbetaRouteDecision,
    topK?: number,
    onProgress?: Parameters<CbetaRetrieveService['retrieveDeep']>[3],
    lexicalKeywords?: string[],
  ): Promise<CbetaRetrieveResult> {
    const retrieveOpts = { lexicalKeywords: lexicalKeywords || [] };
    if (decision.path === 'deep' && decision.coverageMode) {
      return this.retrieve.retrieveDeep(
        searchQuestion,
        decision,
        topK,
        onProgress,
        retrieveOpts,
      );
    }
    return this.retrieve.retrieveFast(
      searchQuestion,
      decision,
      topK,
      retrieveOpts,
    );
  }

  private pack(
    retrieval: CbetaRetrieveResult,
    _decision: CbetaRouteDecision,
  ): { blocks: string[]; used: CbetaChunkHit[]; citations: CbetaCitation[] } {
    const entityBlock =
      retrieval.entities?.length && retrieval.worksScanned
        ? this.entities.formatEntityListBlock(
            retrieval.entities,
            retrieval.worksScanned,
          )
        : undefined;
    const { blocks, used } = this.retrieve.buildContextBlocks(
      retrieval.hits,
      entityBlock,
    );
    return { blocks, used, citations: this.toCitations(used) };
  }

  private metaBase(
    decision: CbetaRouteDecision,
    retrieval: CbetaRetrieveResult,
    retrievalMs: number,
    totalMs: number,
    hitCount: number,
    rewrite: CbetaQueryRewrite,
  ) {
    return {
      corpus: 'cbeta' as const,
      path: decision.path,
      route: decision,
      searchMode: retrieval.searchMode,
      embedError: retrieval.embedError,
      retrievalMs,
      totalMs,
      hitCount,
      entityCount: retrieval.entities?.length ?? 0,
      worksScanned: retrieval.worksScanned ?? [],
      passes: retrieval.passes,
      citationPolicy: 'required' as const,
      queryRewrite: rewrite,
    };
  }

  private intentBrief(
    question: string,
    decision: CbetaRouteDecision,
    retrieval: CbetaRetrieveResult,
    rewrite: CbetaQueryRewrite,
  ): string {
    const answerLang = detectCbetaAnswerLang(question);
    const lines = [
      'CORPUS: CBETA only (/api/cbeta). Separate from tosuthien book RAG (/api/rag).',
      'FORBIDDEN: cite or frame answers using HT Duy Lực Vietnamese books.',
      `PATH: ${decision.path}`,
      `SCOPE: ${decision.scopeNote}`,
      `SEARCH_ZH: ${rewrite.searchZh}`,
      'CITATION UI: sources listed by API under the answer — do not repeat — (title, work_code, juan, p.ref) or urls inside PHẦN 1 body; never expose internal chunk index.',
      'No hit → say not found in selected CBETA scope, in the same language as the question; never invent work_code.',
      'I/O pipeline: any input language → rewrite/search in Hán → PHẦN 1+2 answer in the INPUT language (VI→VI, EN→EN from Hán with zero Vietnamese, ZH→ZH).',
      cbetaAnswerLangBrief(answerLang),
    ];
    if (isCbetaBriefQuestion(question)) {
      lines.push(
        'BRIEF: user asked tóm gọn / yếu chỉ / 簡要 / briefly — keep PHẦN 1 short (≈8–12 sentences), PHẦN 2 2–3 sentences, same language as the question.',
      );
    }
    if (decision.path === 'deep' && decision.coverageMode) {
      lines.push(
        'COVERAGE: chỉ liệt kê tên có trong [CBETA_ENTITY_LIST]; phạm vi = WORKS_SCANNED thực tế; gộp trùng, trình bày một bảng/danh sách mạch lạc.',
      );
    }
    if (retrieval.worksScanned?.length) {
      lines.push(`WORKS_SCANNED: ${retrieval.worksScanned.join(', ')}`);
    }
    if (decision.collections.length) {
      lines.push(`KHÓA COLLECTION: ${decision.collections.join(', ')}`);
    }
    lines.push(`Router: ${decision.reasons.join('; ')}`);
    return lines.join('\n');
  }

  private toCitations(hits: CbetaChunkHit[]): CbetaCitation[] {
    return hits.map((h) => {
      const label = this.retrieve.citationLabel(h);
      return {
        chunkId: h.id,
        workCode: h.workCode,
        collection: h.collection,
        titleZh: h.titleZh,
        juanNo: h.juanNo,
        juanLabel: h.juanLabel,
        chunkIndex: h.chunkIndex,
        label,
        quote: h.contentZh,
        score: h.score,
        cbetaRefStart: h.cbetaRefStart,
        url: this.retrieve.cbetaOnlineUrl(h.workCode, h.cbetaRefStart),
      };
    });
  }

  /** Drop full-text quotes for SSE / localStorage — UI only shows labels + links. */
  private toUiCitations(citations: CbetaCitation[]): CbetaCitation[] {
    return citations.map((c) => ({ ...c, quote: '' }));
  }

  private splitAnswer(raw: string): {
    answer: string;
    aiInterpretation: string;
  } {
    const marker = AI_INTERPRETATION_MARKER;
    const idx = raw.indexOf(marker);
    if (idx < 0) {
      return { answer: raw.trim(), aiInterpretation: '' };
    }
    return {
      answer: raw.slice(0, idx).trim(),
      aiInterpretation: raw.slice(idx + marker.length).trim(),
    };
  }
}
