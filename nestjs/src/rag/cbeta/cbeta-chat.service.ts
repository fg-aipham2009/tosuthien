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
import { formatCbetaCoverageListAnswer } from './cbeta-coverage-answer.util';
import {
  cbetaAnswerLangBrief,
  cbetaEmptyHitMessage,
  detectCbetaAnswerLang,
  isCbetaBriefQuestion,
} from './cbeta-intent.util';
import { parseCbetaCitationHints } from './cbeta-query-parse.util';
import { CbetaRetrieveService } from './cbeta-retrieve.service';
import {
  extractSectionHeadingNeedle,
  formatCbetaSectionListAnswer,
  parseOrderedMastersFromSection,
} from './cbeta-section-list.util';
import {
  detectCbetaSchoolLineage,
  schoolLineageIntentBrief,
} from './cbeta-school-lineage.util';
import {
  extractPersonRelationNeedles,
  formatFasuccessorHeadingGloss,
  formatPersonFasuccessorAnswer,
  isCbetaGlossOnlyQuestion,
  parsePersonFasuccessorBlock,
} from './cbeta-person-relation.util';
import {
  selectEvidenceHits,
  validateCbetaAnswer,
} from './cbeta-evidence.util';
import {
  buildCbetaDiagTrace,
  cbetaDiagEnabled,
} from './cbeta-diag.util';
import {
  isCbetaScriptureExplainIntent,
  scriptureGroundingBrief,
} from './cbeta-scripture-intent.util';
import {
  genreAttributionBrief,
  inferCbetaGenre,
} from './cbeta-genre.util';
import {
  verifyQuestionPhrasesAgainstEvidence,
} from './cbeta-claim-verify.util';
import {
  applyDoctrinalGateToAnswer,
  cbetaStrictVerifyEnabled,
  runDoctrinalAttributionGate,
} from './cbeta-doctrinal-gate.util';
import { verifyContextualClaims } from './cbeta-context-verify.util';
import {
  cbetaQuoteLevelCitationsEnabled,
  cbetaQuoteVerifyV2Enabled,
} from './cbeta-feature-flags.util';
import { repairAnswerQuotesFromEvidence } from './cbeta-quote-align.util';
import { locateQuoteInHit } from './cbeta-quote-locator.util';
import {
  extractAnswerCjkQuotes,
  verifyAnswerQuotesAgainstEvidence,
} from './cbeta-claim-verify.util';
import { extractScripturePhraseNeedles } from './cbeta-scripture-intent.util';
import type {
  CbetaCitation,
  CbetaChunkHit,
  CbetaQueryRewrite,
  CbetaRetrieveResult,
  CbetaRouteDecision,
} from './cbeta.types';
import type { ChatTurn } from '../rag.types';
import { randomUUID } from 'node:crypto';

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
    const requestId = randomUUID();
    const retrieval = await this.runRetrieve(
      rewrite.searchZh,
      decisionMerged,
      options.topK,
      undefined,
      rewrite.keywords,
      question,
    );
    const { blocks, used, citations } = this.pack(
      retrieval,
      decisionMerged,
      question,
    );
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

    const sectionAnswer = this.tryFormatSectionListAnswer(
      question,
      decisionMerged,
      retrieval,
    );
    if (sectionAnswer) {
      const { answer, aiInterpretation } = this.splitAnswer(sectionAnswer);
      const evidenceCites = this.toUiCitations(
        this.toCitations(selectEvidenceHits(used, question, decisionMerged)),
      );
      return {
        answer,
        aiInterpretation,
        citations: evidenceCites,
        entities: retrieval.entities,
        meta: {
          ...this.metaBase(
            decisionMerged,
            retrieval,
            retrievalMs,
            Date.now() - t0,
            used.length,
            rewrite,
          ),
          llmMs: 0,
          coverageAnswer: 'sectionList',
          ...this.maybeDiag({
            requestId,
            question,
            rewrite,
            decision: decisionMerged,
            retrieval,
            used,
            citations: evidenceCites,
            answer,
            generationRoute: 'sectionList',
            blocks,
          }),
        },
      };
    }

    const glossAnswer = formatFasuccessorHeadingGloss(question);
    if (glossAnswer) {
      const { answer, aiInterpretation } = this.splitAnswer(glossAnswer);
      // Prefer chunks that contain the exact 法嗣N人 heading (e.g. T51n2076).
      const heading =
        question.match(
          /([\u3400-\u9fff]{2,40}(?:禪師|和尚)?法嗣[一二三四五六七八九十\d]+人)/u,
        )?.[1] || '';
      const headingHits = heading
        ? used.filter((h) => (h.contentZh || '').includes(heading))
        : [];
      // Only cite lamp/register works for 法嗣N人 gloss — never a random X-collection reprint.
      const dengluHits = headingHits.filter(
        (h) =>
          /傳燈|景德|燈錄/.test(h.titleZh || '') ||
          /^T51n2076/i.test(h.workCode || ''),
      );
      const evidenceCites = dengluHits.length
        ? this.toUiCitations(
            this.toCitations(
              selectEvidenceHits(dengluHits, question, decisionMerged),
            ),
          )
        : [];
      return {
        answer,
        aiInterpretation,
        citations: evidenceCites,
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
          llmMs: 0,
          coverageAnswer: 'gloss',
          ...this.maybeDiag({
            requestId,
            question,
            rewrite,
            decision: decisionMerged,
            retrieval,
            used,
            citations: evidenceCites,
            answer,
            generationRoute: 'gloss',
            blocks,
          }),
        },
      };
    }

    const personAnswer = this.tryFormatPersonRelationAnswer(
      question,
      decisionMerged,
      retrieval,
    );
    if (personAnswer) {
      const { answer, aiInterpretation } = this.splitAnswer(personAnswer);
      const evidenceCites = this.toUiCitations(
        this.toCitations(selectEvidenceHits(used, question, decisionMerged)),
      );
      return {
        answer,
        aiInterpretation,
        citations: evidenceCites,
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
          llmMs: 0,
          coverageAnswer: 'personRelation',
          ...this.maybeDiag({
            requestId,
            question,
            rewrite,
            decision: decisionMerged,
            retrieval,
            used,
            citations: evidenceCites,
            answer,
            generationRoute: 'personRelation',
            blocks,
          }),
        },
      };
    }

    const catalogAnswer = await this.tryFormatWorkCatalogAnswer(question);
    if (catalogAnswer) {
      const { answer, aiInterpretation } = this.splitAnswer(catalogAnswer);
      return {
        answer,
        aiInterpretation,
        citations: this.toUiCitations(citations),
        entities: retrieval.entities,
        meta: {
          ...this.metaBase(
            decisionMerged,
            retrieval,
            retrievalMs,
            Date.now() - t0,
            used.length,
            rewrite,
          ),
          llmMs: 0,
          coverageAnswer: 'workCatalog',
        },
      };
    }

    if (
      decisionMerged.coverageMode &&
      retrieval.entities?.length &&
      retrieval.worksScanned?.length
    ) {
      const raw = formatCbetaCoverageListAnswer(
        question,
        retrieval.entities,
        retrieval.worksScanned,
        this.retrieve.coverageListCharBudget(),
      );
      const { answer, aiInterpretation } = this.splitAnswer(raw);
      return {
        answer,
        aiInterpretation,
        citations: this.toUiCitations(citations),
        entities: retrieval.entities,
        meta: {
          ...this.metaBase(
            decisionMerged,
            retrieval,
            retrievalMs,
            Date.now() - t0,
            used.length,
            rewrite,
          ),
          llmMs: 0,
          coverageAnswer: 'deterministic',
        },
      };
    }

    const evidenceHits = selectEvidenceHits(used, question, decisionMerged);
    const keepExcerpt =
      decisionMerged.quoteVerifyMode || decisionMerged.scriptureExplainMode;
    const evidenceCites = this.toCitations(evidenceHits);
    const phraseClaims = verifyQuestionPhrasesAgainstEvidence(
      question,
      evidenceHits,
    );
    const intentBrief = this.intentBrief(
      question,
      decisionMerged,
      retrieval,
      rewrite,
    );
    const tLlm = Date.now();
    let raw = await this.llm.answerCbeta(
      question,
      blocks.length
        ? blocks
        : ['[CBETA] (chỉ có danh sách entity, không có đoạn trích)'],
      intentBrief,
      options.messages,
    );
    let llmMs = Date.now() - tLlm;
    let { answer, aiInterpretation } = this.splitAnswer(raw);
    let generationRoute = 'llm';

    // One bounded corrective attempt when person-relation answer looks like coverage dump.
    let validationErrors = validateCbetaAnswer({
      question,
      answer,
      decision: decisionMerged,
      evidenceHits,
      citations: evidenceCites,
    });
    if (
      validationErrors.includes('person_relation_looks_like_coverage_dump') ||
      validationErrors.includes('person_relation_names_missing_from_answer')
    ) {
      const retry = this.tryFormatPersonRelationAnswer(
        question,
        decisionMerged,
        retrieval,
      );
      if (retry) {
        ({ answer, aiInterpretation } = this.splitAnswer(retry));
        generationRoute = 'personRelation_retry';
        validationErrors = validateCbetaAnswer({
          question,
          answer,
          decision: decisionMerged,
          evidenceHits,
          citations: evidenceCites,
        });
      }
    }

    let verifyHits = evidenceHits;
    let gateApplied = { answer, applied: [] as string[] };
    if (cbetaQuoteVerifyV2Enabled()) {
      const v2 = await this.applyQuoteVerifyV2({
        question,
        answer,
        decision: decisionMerged,
        evidenceHits,
        retrievalHits: used,
      });
      answer = v2.answer;
      verifyHits = v2.evidenceHits;
      gateApplied = { answer: v2.answer, applied: v2.applied };
      if (v2.applied.length) {
        generationRoute = `${generationRoute}+verify_v2`;
      }
    } else {
      const gate0 = runDoctrinalAttributionGate({
        question,
        answer,
        decision: decisionMerged,
        evidenceHits: verifyHits,
      });
      gateApplied = applyDoctrinalGateToAnswer(answer, gate0);
      answer = gateApplied.answer;
      if (gateApplied.applied.length) {
        generationRoute = `${generationRoute}+gate`;
      }
    }
    const gate = runDoctrinalAttributionGate({
      question,
      answer,
      decision: decisionMerged,
      evidenceHits: verifyHits,
    });
    const contextual = verifyContextualClaims(
      question,
      answer,
      verifyHits,
    );
    const finalCites = this.toCitations(verifyHits, question);

    return {
      answer,
      aiInterpretation,
      citations: this.toUiCitations(finalCites, keepExcerpt),
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
        validationErrors,
        claimVerification: [
          ...phraseClaims,
          ...gate.claims,
          ...contextual.claims,
        ],
        doctrinalGate: {
          enabled: gate.enabled || cbetaStrictVerifyEnabled(),
          findings: gate.findings,
          applied: gateApplied.applied,
          contextual: {
            speakerHint: contextual.pack.speakerHint,
            sectionHint: contextual.pack.sectionHint,
            primaryWork: contextual.pack.primary?.workCode ?? null,
            primaryRef: contextual.pack.primary?.cbetaRefStart ?? null,
            neighborCount: contextual.pack.neighbors.length,
          },
        },
        ...this.maybeDiag({
          requestId,
          question,
          rewrite,
          decision: decisionMerged,
          retrieval,
          used: verifyHits,
          citations: finalCites,
          answer,
          generationRoute,
          blocks,
          validationErrors,
        }),
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

    const progressQueue: Array<{
      pass: number;
      totalPasses: number;
      workCode: string;
      titleZh: string;
      entityCount: number;
    }> = [];
    let retrieveDone = false;
    const retrievalPromise = this.runRetrieve(
      rewrite.searchZh,
      decisionMerged,
      options.topK,
      (p) => {
        progressQueue.push(p);
      },
      rewrite.keywords,
      question,
    ).finally(() => {
      retrieveDone = true;
    });

    while (!retrieveDone || progressQueue.length) {
      while (progressQueue.length) {
        const p = progressQueue.shift()!;
        yield {
          type: 'status',
          phase: 'retrieving',
          message: `Đang quét ${p.pass}/${p.totalPasses}: ${p.titleZh || p.workCode} (≈${p.entityCount} tên)…`,
        };
      }
      if (!retrieveDone) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    const retrieval = await retrievalPromise;

    const requestId = randomUUID();
    const { blocks, used, citations } = this.pack(
      retrieval,
      decisionMerged,
      question,
    );

    // UI citations: evidence-bearing hits only (not the full candidate pool).
    const evidenceHits = selectEvidenceHits(used, question, decisionMerged);
    const keepExcerpt =
      decisionMerged.quoteVerifyMode || decisionMerged.scriptureExplainMode;
    const uiCitations = this.toUiCitations(
      this.toCitations(evidenceHits),
      keepExcerpt,
    );

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
        citationPolicy: 'evidence_only',
        queryRewrite: rewrite,
        requestId,
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

    let raw: string;
    const sectionAnswer = this.tryFormatSectionListAnswer(
      question,
      decisionMerged,
      retrieval,
    );
    const personAnswer = sectionAnswer
      ? null
      : this.tryFormatPersonRelationAnswer(
          question,
          decisionMerged,
          retrieval,
        );
    const catalogAnswer =
      sectionAnswer || personAnswer
        ? null
        : await this.tryFormatWorkCatalogAnswer(question);
    if (sectionAnswer) {
      raw = sectionAnswer;
      yield { type: 'delta', text: raw };
    } else if (personAnswer) {
      raw = personAnswer;
      yield { type: 'delta', text: raw };
    } else if (catalogAnswer) {
      raw = catalogAnswer;
      yield { type: 'delta', text: raw };
    } else if (
      decisionMerged.coverageMode &&
      retrieval.entities?.length &&
      retrieval.worksScanned?.length
    ) {
      // List/coverage: format from entity scan — LLM CoT kept answering in English.
      raw = formatCbetaCoverageListAnswer(
        question,
        retrieval.entities,
        retrieval.worksScanned,
        this.retrieve.coverageListCharBudget(),
      );
      yield { type: 'delta', text: raw };
    } else {
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
      raw = parts.join('');
    }
    const split = this.splitAnswer(raw);
    let answer = split.answer;
    const aiInterpretation = split.aiInterpretation;
    let verifyHits = evidenceHits;
    let gatedApplied: string[] = [];
    if (cbetaQuoteVerifyV2Enabled()) {
      const v2 = await this.applyQuoteVerifyV2({
        question,
        answer,
        decision: decisionMerged,
        evidenceHits,
        retrievalHits: used,
      });
      answer = v2.answer;
      verifyHits = v2.evidenceHits;
      gatedApplied = v2.applied;
    } else {
      const gate0 = runDoctrinalAttributionGate({
        question,
        answer,
        decision: decisionMerged,
        evidenceHits,
      });
      const gated = applyDoctrinalGateToAnswer(answer, gate0);
      answer = gated.answer;
      gatedApplied = gated.applied;
    }
    const gate = runDoctrinalAttributionGate({
      question,
      answer,
      decision: decisionMerged,
      evidenceHits: verifyHits,
    });
    const contextual = verifyContextualClaims(question, answer, verifyHits);
    const streamCites = this.toUiCitations(
      this.toCitations(verifyHits, question),
      decisionMerged.quoteVerifyMode || decisionMerged.scriptureExplainMode,
    );
    yield {
      type: 'done',
      answer,
      aiInterpretation,
      citations: streamCites,
      meta: {
        corpus: 'cbeta',
        path: decisionMerged.path,
        entities: retrieval.entities ?? [],
        worksScanned: retrieval.worksScanned ?? [],
        workDiagnostics: retrieval.workDiagnostics ?? [],
        totalMs: Date.now() - t0,
        queryRewrite: rewrite,
        doctrinalGate: {
          enabled: gate.enabled,
          findings: gate.findings,
          applied: gatedApplied,
          contextual: {
            speakerHint: contextual.pack.speakerHint,
            sectionHint: contextual.pack.sectionHint,
            primaryWork: contextual.pack.primary?.workCode ?? null,
          },
        },
        claimVerification: [...gate.claims, ...contextual.claims],
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
      decision.sectionListMode ? 'mode=sectionList' : null,
      decision.schoolLineageMode ? 'mode=schoolLineage' : null,
      decision.personRelationMode ? 'mode=personRelation' : null,
      decision.quoteVerifyMode ? 'mode=quoteVerify' : null,
      decision.scriptureExplainMode ? 'mode=scriptureExplain' : null,
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
    originalQuestion?: string,
  ): Promise<CbetaRetrieveResult> {
    const retrieveOpts = {
      lexicalKeywords: lexicalKeywords || [],
      // Narrow coverage by the raw user wording (e.g. "truyền đăng lục").
      originalQuestion: originalQuestion || searchQuestion,
    };
    if (decision.sectionListMode) {
      return this.retrieve.retrieveSectionList(
        searchQuestion,
        decision,
        topK,
        retrieveOpts,
      );
    }
    if (decision.schoolLineageMode) {
      return this.retrieve.retrieveSchoolLineage(
        searchQuestion,
        decision,
        topK,
        retrieveOpts,
      );
    }
    if (decision.personRelationMode) {
      return this.retrieve.retrievePersonRelation(
        searchQuestion,
        decision,
        topK,
        retrieveOpts,
      );
    }
    if (
      decision.quoteVerifyMode ||
      decision.scriptureExplainMode ||
      decision.cbetaRefNeedle
    ) {
      return this.retrieve.retrieveScriptureGrounded(
        searchQuestion,
        decision,
        topK,
        retrieveOpts,
      );
    }
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

  /**
   * Deterministic answer for one person's 法嗣 list (heading-scoped).
   */
  private tryFormatPersonRelationAnswer(
    question: string,
    decision: CbetaRouteDecision,
    retrieval: CbetaRetrieveResult,
  ): string | null {
    // Gloss/translate of a quoted 法嗣 heading must not dump the successor list.
    if (
      isCbetaGlossOnlyQuestion(question) ||
      isCbetaScriptureExplainIntent(question)
    ) {
      return null;
    }
    if (!decision.personRelationMode && !decision.cbetaRefNeedle) {
      // Still allow when relation intent was detected via needles in evidence.
      if (
        !/法嗣|pháp\s*tự|Dharma\s+successors?|successors?\s+of/i.test(question)
      ) {
        return null;
      }
    }
    const needles = extractPersonRelationNeedles(question);
    if (!needles.length) return null;
    const scored: Array<{
      hit: (typeof retrieval.hits)[0];
      parsed: NonNullable<ReturnType<typeof parsePersonFasuccessorBlock>>;
      rank: number;
    }> = [];
    for (const hit of retrieval.hits) {
      const parsed = parsePersonFasuccessorBlock(hit.contentZh, needles);
      if (!parsed?.names.length) continue;
      let rank = parsed.names.length;
      if (parsed.expectedCount != null) {
        if (parsed.names.length === parsed.expectedCount) rank += 1000;
        else if (parsed.names.length < parsed.expectedCount) rank -= 100;
      }
      // Prefer TOC headings with an explicit 人 count.
      if (/法嗣[一二三四五六七八九十\d]+人/.test(parsed.heading)) rank += 500;
      scored.push({ hit, parsed, rank });
    }
    scored.sort((a, b) => b.rank - a.rank);
    const best = scored[0];
    if (!best) return null;
    // Reject biography false-positives: bare 法嗣 with noisy names, no count.
    if (
      best.parsed.expectedCount == null &&
      best.parsed.names.length > 6 &&
      !/法嗣[一二三四五六七八九十\d]+人/.test(best.parsed.heading)
    ) {
      return null;
    }
    return formatPersonFasuccessorAnswer({
      question,
      workCode: best.hit.workCode,
      titleZh: best.hit.titleZh || best.hit.workCode,
      juanNo: best.hit.juanNo,
      cbetaRefStart: best.hit.cbetaRefStart,
      userLocator: decision.cbetaRefNeedle
        ? `${decision.workCodes[0] || best.hit.workCode}_${decision.cbetaRefNeedle.startsWith('p') ? decision.cbetaRefNeedle : `p${decision.cbetaRefNeedle}`}`
        : null,
      parsed: best.parsed,
    });
  }

  /**
   * Deterministic answer for heading-scoped registers (馬祖法嗣 五十六人…).
   */
  private tryFormatSectionListAnswer(
    question: string,
    decision: CbetaRouteDecision,
    retrieval: CbetaRetrieveResult,
  ): string | null {
    if (!decision.sectionListMode) return null;
    const hit =
      retrieval.hits.find(
        (h) =>
          /已上四十三人見錄|無機緣語句不錄|五十六人（馬祖法嗣）/.test(
            h.contentZh,
          ),
      ) ||
      retrieval.hits.find(
        (h) =>
          /五十六人|見錄/.test(h.contentZh) &&
          (h.contentZh.match(/禪師|和尚|大師|坐主|居士/g) || []).length >= 20,
      ) ||
      retrieval.hits[0];
    if (!hit?.contentZh) return null;
    const needle = extractSectionHeadingNeedle(question);
    const parsed = parseOrderedMastersFromSection(hit.contentZh, needle);
    if (!parsed.allNames.length) return null;
    return formatCbetaSectionListAnswer({
      question,
      titleZh: hit.titleZh || hit.workCode,
      workCode: hit.workCode,
      juanNo: hit.juanNo,
      cbetaRefStart: hit.cbetaRefStart,
      parsed,
      charBudget: this.retrieve.coverageListCharBudget(),
    });
  }

  /** Catalog answer when user asks work_code ↔ title mapping in the indexed DB. */
  private async tryFormatWorkCatalogAnswer(
    question: string,
  ): Promise<string | null> {
    // Lineage / edge citation questions must not collapse to works-table dump
    // just because the user mentioned "work_code" / "citation".
    if (
      /cạnh|→|⟶|法嗣|thầy|trò|lineage|机缘|機緣|thế\s*hệ|truyền\s*thừa/i.test(
        question,
      )
    ) {
      return null;
    }
    if (
      !/(work[_\s-]?code|mã\s*kinh|là\s*bộ\s*gì|tên\s*hán|trong\s*kho|indexed)/i.test(
        question,
      )
    ) {
      return null;
    }
    const rows = await this.retrieve.lookupWorksByTitleHint(question);
    if (!rows.length) return null;
    const lang = detectCbetaAnswerLang(question);
    const lines = rows.map((r) => `- ${r.work_code} = ${r.title_zh}`);
    if (lang === 'zh') {
      return `依本庫 works 表：\n${lines.join('\n')}`;
    }
    if (lang === 'en') {
      return `From indexed works table:\n${lines.join('\n')}`;
    }
    return `PHẦN 1\n\nTheo bảng works đã index trong kho CBETA này:\n${lines.join('\n')}\n\nPHẦN 2: Đây là metadata kho đã index, không suy ra từ đoạn trích hybrid.`;
  }

  private pack(
    retrieval: CbetaRetrieveResult,
    decision: CbetaRouteDecision,
    question = '',
  ): { blocks: string[]; used: CbetaChunkHit[]; citations: CbetaCitation[] } {
    // Coverage list: entity list is the spine. Drop hybrid passage hits —
    // one unrelated chunk primed English meta ("The context block is unrelated…").
    if (
      decision.coverageMode &&
      retrieval.entities?.length &&
      retrieval.worksScanned?.length
    ) {
      const entityBudget = this.retrieve.contextCharBudget();
      const entityBlock = this.entities.formatEntityListBlock(
        retrieval.entities,
        retrieval.worksScanned,
        entityBudget,
      );
      // Keep hybrid hits only for UI citations; answer text comes from entities.
      return {
        blocks: [entityBlock],
        used: retrieval.hits,
        citations: this.toCitations(retrieval.hits),
      };
    }
    // Person-relation / locator / brief: pack evidence-bearing chunks first.
    const evidenceFirst =
      decision.personRelationMode ||
      decision.quoteVerifyMode ||
      decision.scriptureExplainMode ||
      !!decision.cbetaRefNeedle ||
      isCbetaBriefQuestion(question) ||
      /có nghĩa gì|nghĩa là gì|chỉ số lượng|tối đa\s*\d+\s*câu/i.test(
        question,
      );
    const orderedHits = evidenceFirst
      ? (() => {
          const evidence = selectEvidenceHits(
            retrieval.hits,
            question,
            decision,
          );
          // Scripture/quote: pack evidence (+ same-work neighbors already in hits).
          // Do not append unrelated hybrid rest — that flooded UI citations.
          if (
            decision.quoteVerifyMode ||
            decision.scriptureExplainMode
          ) {
            const evidenceWorks = new Set(evidence.map((h) => h.workCode));
            const neighbors = retrieval.hits.filter(
              (h) =>
                evidenceWorks.has(h.workCode) &&
                !evidence.some((e) => e.id === h.id),
            );
            return evidence.length
              ? [...evidence, ...neighbors]
              : retrieval.hits;
          }
          const rest = retrieval.hits.filter(
            (h) => !evidence.some((e) => e.id === h.id),
          );
          return [...evidence, ...rest];
        })()
      : retrieval.hits;
    // Share of context budget for entity list (rest reserved for passage blocks).
    const entityBudget = Math.floor(this.retrieve.contextCharBudget() / 2);
    const entityBlock =
      retrieval.entities?.length && retrieval.worksScanned
        ? this.entities.formatEntityListBlock(
            retrieval.entities,
            retrieval.worksScanned,
            entityBudget,
          )
        : undefined;
    const { blocks, used } = this.retrieve.buildContextBlocks(
      orderedHits,
      entityBlock,
    );
    return { blocks, used, citations: this.toCitations(used) };
  }

  private maybeDiag(input: {
    requestId: string;
    question: string;
    rewrite: CbetaQueryRewrite;
    decision: CbetaRouteDecision;
    retrieval: CbetaRetrieveResult;
    used: CbetaChunkHit[];
    citations: CbetaCitation[];
    answer: string;
    generationRoute: string;
    blocks: string[];
    validationErrors?: string[];
  }): { diag?: ReturnType<typeof buildCbetaDiagTrace> } {
    if (!cbetaDiagEnabled()) return {};
    const validationErrors =
      input.validationErrors ??
      validateCbetaAnswer({
        question: input.question,
        answer: input.answer,
        decision: input.decision,
        evidenceHits: input.used,
        citations: input.citations,
      });
    return {
      diag: buildCbetaDiagTrace({
        requestId: input.requestId,
        query: input.question,
        searchZh: input.rewrite.searchZh,
        decision: input.decision,
        entities: extractPersonRelationNeedles(input.question),
        retrievalQueries: [input.rewrite.searchZh, ...input.rewrite.keywords],
        retrieved: input.retrieval.hits,
        selected: input.used,
        contextChars: input.blocks.reduce((n, b) => n + b.length, 0),
        cacheHit: !!input.rewrite.reason?.includes('cache'),
        cacheKey: input.rewrite.reason || '',
        generationRoute: input.generationRoute,
        citedIds: input.citations.map((c) => c.chunkId),
        validationErrors,
      }),
    };
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
      workDiagnostics: retrieval.workDiagnostics ?? [],
      passes: retrieval.passes,
      citationPolicy: 'required' as const,
      queryRewrite: rewrite,
    };
  }

  /**
   * VERIFY_V2: align quotes to evidence spans, bounded phrase re-lookup,
   * then apply the existing doctrinal gate (strip still requires evidence).
   */
  private async applyQuoteVerifyV2(input: {
    question: string;
    answer: string;
    decision: CbetaRouteDecision;
    evidenceHits: CbetaChunkHit[];
    retrievalHits: CbetaChunkHit[];
  }): Promise<{
    answer: string;
    evidenceHits: CbetaChunkHit[];
    applied: string[];
  }> {
    const applied: string[] = [];
    let hits = [...input.evidenceHits];
    const pool = [...input.retrievalHits, ...input.evidenceHits];
    const byId = new Map(pool.map((h) => [h.id, h]));

    let { answer, repairs } = repairAnswerQuotesFromEvidence(
      input.answer,
      [...byId.values()],
    );
    if (repairs.some((r) => r.aligned !== r.original)) {
      applied.push('align_quotes_to_evidence');
    }

    let { unsupportedQuotes } = verifyAnswerQuotesAgainstEvidence(answer, hits);
    if (unsupportedQuotes.length) {
      const extra = await this.retrieve.lookupPhrasesBounded(
        unsupportedQuotes.filter((q) => q.length >= 4),
        input.decision.workCodes,
      );
      if (extra.length) {
        for (const h of extra) byId.set(h.id, h);
        hits = [...hits];
        for (const h of extra) {
          if (!hits.some((x) => x.id === h.id)) hits.push(h);
        }
        applied.push('bounded_phrase_rellookup');
        const repaired2 = repairAnswerQuotesFromEvidence(answer, [
          ...byId.values(),
        ]);
        answer = repaired2.answer;
        if (repaired2.repairs.some((r) => r.aligned !== r.original)) {
          applied.push('align_quotes_after_rellookup');
        }
      }
    }

    const gate = runDoctrinalAttributionGate({
      question: input.question,
      answer,
      decision: input.decision,
      evidenceHits: hits,
    });
    const gated = applyDoctrinalGateToAnswer(answer, gate);
    applied.push(...gated.applied);
    return { answer: gated.answer, evidenceHits: hits, applied };
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
      'CITATION UI: sources listed by API under the answer — do not repeat long citation panels or urls inside PHẦN 1 body; never expose internal chunk index.',
      'No hit → say not found in selected CBETA scope, in the same language as the question; never invent work_code.',
      'I/O: rewrite/search in Hán → answer in ANSWER_LANG. Priority: Vietnamese signal→vi, CJK→zh, clear English→en, else vi.',
      cbetaAnswerLangBrief(answerLang),
    ];
    if (decision.cbetaRefNeedle) {
      const refBare = decision.cbetaRefNeedle.replace(/^p\.?/i, '');
      lines.push(
        `LOCATOR: user asked about cbeta_ref ${decision.cbetaRefNeedle} — PHẦN 1 MUST state work_code, juan/quyển, and the literal locator ${refBare} (e.g. p.${refBare}).`,
      );
    }
    if (isCbetaBriefQuestion(question)) {
      lines.push(
        'BRIEF: user asked tóm gọn / yếu chỉ / 簡要 / briefly — keep PHẦN 1 short (≈8–12 sentences), PHẦN 2 2–3 sentences, same language as the question.',
      );
    }
    if (decision.path === 'deep' && decision.coverageMode) {
      lines.push(
        'COVERAGE: chỉ liệt kê tên có trong [CBETA_ENTITY_LIST]; phạm vi = WORKS_SCANNED; gộp trùng thành bảng (Tây Thiên / Đông Độ / …). Viết ngay danh sách tiếng Việt — CẤM English meta về “context / entity list / noisy”.',
      );
    }
    if (decision.sectionListMode) {
      lines.push(
        'SECTION_LIST: trả lời theo mục lục / danh sách pháp tự trong chunk đã định vị; ghi đủ tên Hán theo thứ tự kinh văn + work_code + quyển + cbeta_ref.',
      );
    }
    if (decision.personRelationMode) {
      lines.push(
        'PERSON_RELATION: trả lời đúng pháp tự / 法嗣 của một vị được hỏi — chỉ lấy khối tiêu đề tương ứng trong ngữ cảnh; CẤM liệt kê Tây Thiên/Đông Độ / toàn bộ truyền đăng; nêu work_code + locator khi có.',
      );
    }
    if (decision.quoteVerifyMode || decision.scriptureExplainMode) {
      lines.push(scriptureGroundingBrief(question));
    }
    if (retrieval.hits?.length) {
      const genres = [
        ...new Set(
          retrieval.hits
            .slice(0, 8)
            .map((h) =>
              inferCbetaGenre({
                titleZh: h.titleZh,
                collection: h.collection,
                workCode: h.workCode,
              }),
            ),
        ),
      ];
      if (genres.length) {
        lines.push(
          `GENRE_HINTS: ${genres.map((g) => genreAttributionBrief(g)).join(' | ')}`,
        );
      }
    }
    if (/truyền\s*thừa|法嗣|師承|→|edges?|lineage/i.test(question)) {
      lines.push(
        'LINEAGE: với mỗi cạnh thầy–trò, nêu bằng chứng từ CBETA và ghi cả dị danh Hán (ví dụ 馬祖道一/大寂, 百丈懷海, 黃檗希運, 臨濟義玄) — không chỉ phiên âm Việt.',
      );
    }
    if (decision.schoolLineageMode) {
      const spec = detectCbetaSchoolLineage(question);
      if (spec) lines.push(schoolLineageIntentBrief(spec));
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

  private toCitations(
    hits: CbetaChunkHit[],
    question?: string,
  ): CbetaCitation[] {
    const phrases = question
      ? extractScripturePhraseNeedles(question).filter((p) => p.length >= 4)
      : [];
    const quoteLevel = cbetaQuoteLevelCitationsEnabled();
    return hits.map((h) => {
      const genre = inferCbetaGenre({
        titleZh: h.titleZh,
        collection: h.collection,
        workCode: h.workCode,
      });
      const base = this.retrieve.citationLabel(h);
      const label = genre !== '其他' ? `${base} · [${genre}]` : base;
      const cite: CbetaCitation = {
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
      if (quoteLevel) {
        let loc = null as ReturnType<typeof locateQuoteInHit>;
        for (const p of phrases) {
          loc = locateQuoteInHit(h, p);
          if (loc) break;
        }
        cite.workId = h.workCode;
        cite.juan = h.juanNo;
        cite.evidenceId = h.id;
        cite.chunkStartLocator = h.cbetaRefStart;
        cite.chunkEndLocator = h.cbetaRefStart;
        if (loc) {
          cite.quoteStartLocator = loc.quoteStartLocator;
          cite.quoteEndLocator = loc.quoteEndLocator;
          cite.locatorPrecision = loc.locatorPrecision;
          cite.quote = loc.evidenceSpan;
        } else {
          cite.quoteStartLocator = h.cbetaRefStart;
          cite.quoteEndLocator = h.cbetaRefStart;
          cite.locatorPrecision = 'passage';
        }
      }
      return cite;
    });
  }

  /**
   * UI citations: keep a short evidence excerpt for scripture/quote modes;
   * otherwise labels + links only (avoids localStorage / SSE bloat).
   */
  private toUiCitations(
    citations: CbetaCitation[],
    keepExcerpt = false,
  ): CbetaCitation[] {
    return citations.map((c) => ({
      ...c,
      quote: keepExcerpt
        ? (c.quote || '').replace(/\s+/g, ' ').trim().slice(0, 180)
        : '',
    }));
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
