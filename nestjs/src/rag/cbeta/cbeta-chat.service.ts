import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AI_INTERPRETATION_MARKER } from '../rag.constants';
import { LlmService } from '../llm.service';
import type { AnswerStyleContext } from '../rag-answer-style';
import type { ChatOptions, ChatStreamEvent } from '../rag.types';
import { routeCbetaQuery } from './cbeta-router';
import { CbetaDbService } from './cbeta-db.service';
import { CbetaEntitiesService } from './cbeta-entities.service';
import { CbetaRetrieveService } from './cbeta-retrieve.service';
import type {
  CbetaCitation,
  CbetaChunkHit,
  CbetaRetrieveResult,
  CbetaRouteDecision,
} from './cbeta.types';

const CBETA_STYLE: AnswerStyleContext = {
  style: 'kinh_long',
  kinhBlockCount: 1,
  nguLucBlockCount: 0,
};

@Injectable()
export class CbetaChatService {
  constructor(
    private readonly db: CbetaDbService,
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

  route(question: string, options: ChatOptions = {}): CbetaRouteDecision {
    return routeCbetaQuery({
      question,
      corpus: 'cbeta',
      collections: options.cbetaCollections,
      forcePath: options.cbetaPath,
    });
  }

  async chat(question: string, options: ChatOptions = {}) {
    this.assertCanChat(question);
    const t0 = Date.now();
    const decision = this.route(question, options);
    const retrieval = await this.runRetrieve(question, decision, options.topK);
    const { blocks, used, citations } = this.pack(retrieval, decision);
    const retrievalMs = Date.now() - t0;

    if (!blocks.length && !retrieval.entities?.length) {
      return {
        answer:
          'Trong tư liệu CBETA hiện có (phạm vi đã chọn) chưa thấy nội dung này.',
        aiInterpretation: '',
        citations: [],
        entities: [],
        meta: this.metaBase(decision, retrieval, retrievalMs, Date.now() - t0, 0),
      };
    }

    const intentBrief = this.intentBrief(decision, retrieval);
    const tLlm = Date.now();
    const raw = await this.llm.answer(
      question,
      blocks.length ? blocks : ['[CBETA] (chỉ có danh sách entity, không có đoạn trích)'],
      CBETA_STYLE,
      intentBrief,
      options.messages,
    );
    const llmMs = Date.now() - tLlm;
    const { answer, aiInterpretation } = this.splitAnswer(raw);

    return {
      answer,
      aiInterpretation,
      citations,
      entities: retrieval.entities ?? [],
      meta: {
        ...this.metaBase(decision, retrieval, retrievalMs, Date.now() - t0, used.length),
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
    const decision = this.route(question, options);

    yield {
      type: 'status',
      phase: 'retrieving',
      message:
        decision.path === 'deep'
          ? 'Đang quét truyền đăng / ngũ đăng (coverage)…'
          : undefined,
    };

    const retrieval = await this.runRetrieve(
      question,
      decision,
      options.topK,
      (p) => {
        // progress surfaced via status message on next tick — stored in meta
        void p;
      },
    );

    const { blocks, used, citations } = this.pack(retrieval, decision);

    yield {
      type: 'meta',
      meta: {
        corpus: 'cbeta',
        path: decision.path,
        route: decision,
        searchMode: retrieval.searchMode,
        embedError: retrieval.embedError,
        retrievalMs: Date.now() - t0,
        hitCount: used.length,
        entityCount: retrieval.entities?.length ?? 0,
        worksScanned: retrieval.worksScanned ?? [],
        passes: retrieval.passes,
        citationPolicy: 'required',
      },
    };

    yield { type: 'citations', citations };

    if (!blocks.length && !retrieval.entities?.length) {
      const msg =
        'Trong tư liệu CBETA hiện có (phạm vi đã chọn) chưa thấy nội dung này.';
      yield { type: 'delta', text: msg };
      yield {
        type: 'done',
        answer: msg,
        aiInterpretation: '',
        citations: [],
        meta: { corpus: 'cbeta', path: decision.path, totalMs: Date.now() - t0 },
      };
      return;
    }

    yield { type: 'status', phase: 'generating' };
    const intentBrief = this.intentBrief(decision, retrieval);
    const parts: string[] = [];
    for await (const delta of this.llm.answerStream(
      question,
      blocks.length ? blocks : ['[CBETA] (chỉ có danh sách entity)'],
      CBETA_STYLE,
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
      citations,
      meta: {
        corpus: 'cbeta',
        path: decision.path,
        entities: retrieval.entities ?? [],
        worksScanned: retrieval.worksScanned ?? [],
        totalMs: Date.now() - t0,
      },
    };
  }

  private async runRetrieve(
    question: string,
    decision: CbetaRouteDecision,
    topK?: number,
    onProgress?: Parameters<CbetaRetrieveService['retrieveDeep']>[3],
  ): Promise<CbetaRetrieveResult> {
    if (decision.path === 'deep') {
      return this.retrieve.retrieveDeep(question, decision, topK, onProgress);
    }
    return this.retrieve.retrieveFast(question, decision, topK);
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
    };
  }

  private intentBrief(
    decision: CbetaRouteDecision,
    retrieval: CbetaRetrieveResult,
  ): string {
    const lines = [
      'CORPUS: CBETA (Hán tạng) — API riêng /api/cbeta; không dùng sách Việt Duy Lực.',
      `PATH: ${decision.path}`,
      decision.scopeNote,
      'CITATION BẮT BUỘC: — (Tên thư, work_code, 卷/chunk) khớp dòng Trích dẫn.',
      'Không có nguồn → nói chưa thấy; CẤM bịa tên / work_code.',
    ];
    if (decision.path === 'deep') {
      lines.push(
        'COVERAGE: ưu tiên khối [CBETA_ENTITY_LIST]; chỉ liệt kê tên có trong list; ghi rõ work đã quét.',
      );
      if (retrieval.worksScanned?.length) {
        lines.push(`WORKS_SCANNED: ${retrieval.worksScanned.join(', ')}`);
      }
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
        quote: h.contentZh.trim(),
        score: h.score,
        cbetaRefStart: h.cbetaRefStart,
      };
    });
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
