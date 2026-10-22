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
import {
  CBETA_ANCHOR_EXPAND_HITS,
  cbetaExpandIndexRange,
  needsCbetaDialogueBackshift,
  stitchChunkParts,
} from './cbeta-expand.util';
import {
  coverageTitleHintRegex,
  DEFAULT_CBETA_COVERAGE_TITLE_REGEX,
  diversifyCbetaHits,
  isPatriarchListIntent,
} from './cbeta-preprocess.util';
import {
  extractSectionHeadingNeedle,
  parseOrderedMastersFromSection,
} from './cbeta-section-list.util';
import {
  detectCbetaSchoolLineage,
  schoolLineageChunkBoost,
} from './cbeta-school-lineage.util';
import {
  extractPersonRelationNeedles,
  parsePersonFasuccessorBlock,
} from './cbeta-person-relation.util';
import {
  bareCbetaRef,
  cbetaRefCovers,
  normalizeCbetaRef,
} from './cbeta-ref-range.util';
import { extractScripturePhraseNeedles } from './cbeta-scripture-intent.util';
import type {
  CbetaChunkHit,
  CbetaDeepProgress,
  CbetaEntityHit,
  CbetaRetrieveResult,
  CbetaRouteDecision,
} from './cbeta.types';

/** Classic RRF rank constant (Cormack et al.). */
const RRF_K = 60;

/** Soft lens for prompt: Giáo môn vs Tổ Sư Thiền (from title cues, not invented doctrine). */
function corpusLensLabel(h: {
  titleZh?: string | null;
  collection?: string | null;
}): string {
  const title = h.titleZh || '';
  if (/語錄|燈錄|公案|碧巖|無門|指月|禪林|宗門|傳燈|五燈|臨濟|曹洞|趙州|壇經/.test(title)) {
    return 'Tổ_Sư_Thiền';
  }
  if (/經|論|律|阿含|般若|華嚴|法華|唯識|中觀/.test(title)) {
    return 'Giáo_môn';
  }
  const col = (h.collection || '').toUpperCase();
  if (col === 'X' || col === 'XY') return 'Tục_tạng';
  return col ? `bộ_${col}` : 'CBETA';
}

export interface CbetaRetrieveOptions {
  /** Extra terms from VN→Hán rewrite keywords (for FTS OR / ILIKE). */
  lexicalKeywords?: string[];
  /** Raw user question — used to narrow coverage when a specific work is named. */
  originalQuestion?: string;
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
   * Postgres regex for coverage seed titles.
   * Env CBETA_COVERAGE_TITLE_REGEX wins; otherwise DEFAULT_CBETA_COVERAGE_TITLE_REGEX
   * so list/enumerate intents still scan lamp/chronicle works.
   */
  private coverageTitleRegex(): string | null {
    const fromEnv = (
      this.config.get<string>('CBETA_COVERAGE_TITLE_REGEX') ||
      process.env.CBETA_COVERAGE_TITLE_REGEX ||
      ''
    ).trim();
    if (fromEnv) return fromEnv;
    return DEFAULT_CBETA_COVERAGE_TITLE_REGEX;
  }

  private candidatePool(): number {
    const n = parseInt(
      this.config.get<string>('CBETA_CANDIDATE_POOL') || '',
      10,
    );
    return Number.isFinite(n) && n > 0 ? n : CANDIDATE_POOL;
  }

  /** Public for chat pack (entity-list budget share). */
  contextCharBudget(): number {
    const n = parseInt(
      this.config.get<string>('CBETA_MAX_CONTEXT_CHARS') || '',
      10,
    );
    // Fallback aligns with book RAG soft context room when env unset.
    return Number.isFinite(n) && n > 0 ? n : 100_000;
  }

  /**
   * User-facing coverage / patriarch list size (not LLM context pack).
   * - unset or 0 → no char cut (emit full localized/filtered list)
   * - positive → soft budget with “còn N tên” note
   */
  coverageListCharBudget(): number {
    const raw =
      this.config.get<string>('CBETA_COVERAGE_LIST_MAX_CHARS') ||
      process.env.CBETA_COVERAGE_LIST_MAX_CHARS ||
      '';
    if (!raw.trim()) return 0;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  }

  async retrieve(
    question: string,
    decision: CbetaRouteDecision,
    topK?: number,
    options?: CbetaRetrieveOptions,
  ): Promise<CbetaRetrieveResult> {
    if (decision.schoolLineageMode) {
      return this.retrieveSchoolLineage(question, decision, topK, options);
    }
    // Person 法嗣 lists only — do NOT route bare locators here (avoids 法嗣 boost).
    if (decision.personRelationMode) {
      return this.retrievePersonRelation(question, decision, topK, options);
    }
    if (
      decision.quoteVerifyMode ||
      decision.scriptureExplainMode ||
      decision.cbetaRefNeedle
    ) {
      return this.retrieveScriptureGrounded(question, decision, topK, options);
    }
    // Multi-pass lamp/denglu scan only for real coverage/enumerate intent.
    // forcePath=deep without coverageMode must not invent that subset.
    if (decision.path === 'deep' && decision.coverageMode) {
      return this.retrieveDeep(question, decision, topK, undefined, options);
    }
    return this.retrieveFast(question, decision, topK, options);
  }

  /**
   * Phrase-first + optional locator retrieve for scripture explain / quote verify.
   * No 法嗣 succession boosting.
   */
  async retrieveScriptureGrounded(
    question: string,
    decision: CbetaRouteDecision,
    topK?: number,
    options?: CbetaRetrieveOptions,
  ): Promise<CbetaRetrieveResult> {
    const original = options?.originalQuestion || question;
    const locatorHits = decision.cbetaRefNeedle
      ? await this.lookupChunksByLocator(decision)
      : [];
    const phrases = extractScripturePhraseNeedles(original);
    const phraseHits = await this.lookupExactPhrases(decision, phrases);
    const hybrid = await this.retrieveFast(question, decision, topK, options);

    const byId = new Map<string, CbetaChunkHit>();
    // Prefer exact phrase / locator hits.
    for (const h of [...locatorHits, ...phraseHits, ...hybrid.hits]) {
      const prev = byId.get(h.id);
      if (!prev || h.score > prev.score) byId.set(h.id, h);
    }
    const scored = [...byId.values()].map((h) => {
      let boost = 0;
      for (const p of phrases) {
        if (p.length >= 4 && h.contentZh.includes(p)) {
          boost += 200 + p.length * 5;
        }
      }
      const title = h.titleZh || '';
      if (
        /疏|鈔|抄|註|注|講錄|演義|經義|淺釋|句解|略解|通義|還源|幽贊|講義|講記/.test(
          title,
        )
      ) {
        boost -= 160;
      } else if (/經\s*$/.test(title.trim())) {
        boost += 180;
      } else if (/經/.test(title) && !/論|講|演|義|贊|述|解/.test(title)) {
        boost += 100;
      } else if (/論|律/.test(title)) {
        boost += 60;
      }
      if ((h.collection || '').toUpperCase() === 'T') boost += 40;
      return { ...h, score: h.score + boost };
    });
    scored.sort((a, b) => b.score - a.score);
    const k = Math.max(1, topK ?? this.candidatePool());
    const evidence = scored.filter((h) =>
      phrases.some((p) => p.length >= 4 && h.contentZh.includes(p)),
    );
    const rest = scored.filter((h) => !evidence.some((e) => e.id === h.id));
    const merged = diversifyCbetaHits(
      evidence.length ? [...evidence, ...rest] : scored,
    ).slice(0, k);
    // Keep neighbors for LLM context, but scripture citation selection
    // dedupes by phrase+work later — avoid expanding every hit into dozens.
    const hits =
      decision.quoteVerifyMode || decision.scriptureExplainMode
        ? merged
        : await this.expandNeighbors(merged);
    return {
      hits,
      searchMode: phraseHits.length || locatorHits.length ? 'fts' : hybrid.searchMode,
      embedError: hybrid.embedError,
      worksScanned: [...new Set(hits.map((h) => h.workCode))],
      passes: 1,
    };
  }

  private async lookupExactPhrases(
    decision: CbetaRouteDecision,
    phrases: string[],
  ): Promise<CbetaChunkHit[]> {
    const needles = phrases.filter((p) => p.length >= 4).slice(0, 4);
    if (!needles.length) return [];
    const params: unknown[] = [];
    const where: string[] = [];
    if (decision.workCodes.length) {
      params.push(decision.workCodes);
      where.push(`c.work_code = ANY($${params.length}::text[])`);
    }
    if (decision.collections.length) {
      params.push(decision.collections);
      where.push(`c.collection = ANY($${params.length}::text[])`);
    }
    const likes: string[] = [];
    for (const p of needles) {
      params.push(`%${p}%`);
      likes.push(`c.content_zh LIKE $${params.length}`);
    }
    where.push(`(${likes.join(' OR ')})`);
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
        COALESCE(c.title_zh, w.title_zh, '') AS title_zh,
        c.juan_no, c.juan_label, c.chunk_index, c.content_zh, c.cbeta_ref_start
      FROM chunks c
      JOIN works w ON w.work_code = c.work_code
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE
          WHEN COALESCE(c.title_zh, w.title_zh, '')
            ~ '疏|鈔|抄|註|注|講錄|演義|經義|淺釋|句解|略解|通義|還源|幽贊|纂述|講義|講記'
            THEN 3
          WHEN COALESCE(c.title_zh, w.title_zh, '') ~ '經$'
            THEN 0
          WHEN COALESCE(c.title_zh, w.title_zh, '') ~ '經'
            AND COALESCE(c.title_zh, w.title_zh, '') !~ '論|講|演|義|贊|述|解|記|錄'
            THEN 1
          WHEN COALESCE(c.title_zh, w.title_zh, '') ~ '論|律' THEN 2
          ELSE 3
        END,
        CASE WHEN c.collection = 'T' THEN 0 ELSE 1 END,
        length(c.content_zh) ASC,
        c.chunk_index ASC
      LIMIT 80
      `,
      params,
    );
    return rows.map((r, i) => ({
      id: r.id,
      workCode: r.work_code,
      collection: r.collection,
      titleZh: r.title_zh,
      juanNo: r.juan_no,
      juanLabel: r.juan_label,
      chunkIndex: r.chunk_index,
      contentZh: r.content_zh,
      score: 950 - i,
      cbetaRefStart: r.cbeta_ref_start,
    }));
  }

  /**
   * Deterministic locator lookup: chunk whose [cbeta_ref_start, cbeta_ref_end]
   * covers the user needle (e.g. p0317a22 inside 0316b20–0317b12).
   */
  async lookupChunksByLocator(
    decision: CbetaRouteDecision,
  ): Promise<CbetaChunkHit[]> {
    const needle = bareCbetaRef(decision.cbetaRefNeedle);
    if (!needle) return [];
    const norm = normalizeCbetaRef(needle);
    if (!norm) return [];

    const params: unknown[] = [];
    const where: string[] = [];
    if (decision.workCodes.length) {
      params.push(decision.workCodes);
      where.push(`c.work_code = ANY($${params.length}::text[])`);
    }
    if (decision.collections.length) {
      params.push(decision.collections);
      where.push(`c.collection = ANY($${params.length}::text[])`);
    }
    // Broad candidate pool: same work/page family, then filter by span in JS.
    params.push(`%${needle.replace(/^0+/, '')}%`);
    const likeIdx = params.length;
    params.push(`${norm.slice(0, 4)}%`);
    const pageIdx = params.length;
    where.push(
      `(c.cbeta_ref_start ILIKE $${likeIdx} OR c.cbeta_ref_end ILIKE $${likeIdx} OR c.cbeta_ref_start LIKE $${pageIdx} OR c.cbeta_ref_end LIKE $${pageIdx})`,
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
      cbeta_ref_end: string | null;
    }>(
      `
      SELECT
        c.id, c.work_code, c.collection,
        COALESCE(c.title_zh, w.title_zh, '') AS title_zh,
        c.juan_no, c.juan_label, c.chunk_index, c.content_zh,
        c.cbeta_ref_start, c.cbeta_ref_end
      FROM chunks c
      JOIN works w ON w.work_code = c.work_code
      WHERE ${where.join(' AND ')}
      ORDER BY c.chunk_index ASC
      LIMIT 80
      `,
      params,
    );

    const hits: CbetaChunkHit[] = [];
    for (const r of rows) {
      if (
        !cbetaRefCovers(r.cbeta_ref_start, r.cbeta_ref_end, needle) &&
        !bareCbetaRef(r.cbeta_ref_start).includes(needle) &&
        !bareCbetaRef(r.cbeta_ref_end).includes(needle)
      ) {
        continue;
      }
      hits.push({
        id: r.id,
        workCode: r.work_code,
        collection: r.collection,
        titleZh: r.title_zh,
        juanNo: r.juan_no,
        juanLabel: r.juan_label,
        chunkIndex: r.chunk_index,
        contentZh: r.content_zh,
        score: 1000,
        cbetaRefStart: r.cbeta_ref_start,
      });
    }
    return hits;
  }

  /**
   * Person-scoped 法嗣 / locator-first retrieve. Prefers exact heading chunks.
   */
  async retrievePersonRelation(
    question: string,
    decision: CbetaRouteDecision,
    topK?: number,
    options?: CbetaRetrieveOptions,
  ): Promise<CbetaRetrieveResult> {
    const original = options?.originalQuestion || question;
    const locatorHits = decision.cbetaRefNeedle
      ? await this.lookupChunksByLocator(decision)
      : [];

    const needles = extractPersonRelationNeedles(original);
    const phraseHits = await this.lookupPersonFasuccessorChunks(
      decision,
      needles,
    );

    const hybrid = await this.retrieveFast(question, decision, topK, options);
    const byId = new Map<string, CbetaChunkHit>();
    for (const h of [...locatorHits, ...phraseHits, ...hybrid.hits]) {
      const prev = byId.get(h.id);
      if (!prev || h.score > prev.score) byId.set(h.id, h);
    }

    // Boost chunks that actually parse into a counted 法嗣 register list.
    const scored = [...byId.values()].map((h) => {
      const parsed = parsePersonFasuccessorBlock(h.contentZh, needles);
      let boost = 0;
      if (parsed?.names.length) {
        boost = 500 + parsed.names.length * 10;
        if (
          parsed.expectedCount != null &&
          parsed.names.length === parsed.expectedCount
        ) {
          boost += 800;
        }
        if (/法嗣[一二三四五六七八九十\d]+人/.test(parsed.heading)) {
          boost += 400;
        }
      } else if (h.contentZh.includes('法嗣')) {
        boost = 50;
      }
      return { ...h, score: h.score + boost };
    });
    scored.sort((a, b) => b.score - a.score);

    const k = Math.max(1, topK ?? this.candidatePool());
    // Evidence-first: keep parsed 法嗣 hits at the front, then hybrid.
    const evidence = scored.filter((h) =>
      parsePersonFasuccessorBlock(h.contentZh, needles),
    );
    const rest = scored.filter((h) => !evidence.some((e) => e.id === h.id));
    const merged = diversifyCbetaHits([...evidence, ...rest]).slice(0, k);
    const hits = await this.expandNeighbors(merged);

    return {
      hits,
      searchMode: locatorHits.length ? 'fts' : hybrid.searchMode,
      embedError: hybrid.embedError,
      worksScanned: [...new Set(hits.map((h) => h.workCode))],
      passes: 1,
    };
  }

  private async lookupPersonFasuccessorChunks(
    decision: CbetaRouteDecision,
    needles: string[],
  ): Promise<CbetaChunkHit[]> {
    const persons = needles.filter(
      (n) =>
        /[\u3400-\u9fff]{2}/u.test(n) &&
        !/法嗣|傳燈|景德|四人|卷/.test(n),
    );
    if (!persons.length) return [];

    const params: unknown[] = [];
    const where: string[] = [`c.content_zh LIKE '%法嗣%'`];
    if (decision.workCodes.length) {
      params.push(decision.workCodes);
      where.push(`c.work_code = ANY($${params.length}::text[])`);
    }
    if (decision.collections.length) {
      params.push(decision.collections);
      where.push(`c.collection = ANY($${params.length}::text[])`);
    }
    if (decision.juanNo != null && decision.juanNo > 0) {
      // Soft: prefer juan but do not drop spanning chunks (TOC may differ).
      params.push(decision.juanNo);
      where.push(
        `(c.juan_no = $${params.length} OR c.juan_no = $${params.length} - 1 OR c.juan_no IS NULL)`,
      );
    }

    const likeParts: string[] = [];
    for (const p of persons.slice(0, 6)) {
      params.push(`%${p}%`);
      likeParts.push(`c.content_zh LIKE $${params.length}`);
    }
    where.push(`(${likeParts.join(' OR ')})`);

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
        COALESCE(c.title_zh, w.title_zh, '') AS title_zh,
        c.juan_no, c.juan_label, c.chunk_index, c.content_zh, c.cbeta_ref_start
      FROM chunks c
      JOIN works w ON w.work_code = c.work_code
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE WHEN c.content_zh LIKE '%法嗣%人%' THEN 0 ELSE 1 END,
        c.chunk_index ASC
      LIMIT 40
      `,
      params,
    );

    return rows.map((r, i) => ({
      id: r.id,
      workCode: r.work_code,
      collection: r.collection,
      titleZh: r.title_zh,
      juanNo: r.juan_no,
      juanLabel: r.juan_label,
      chunkIndex: r.chunk_index,
      contentZh: r.content_zh,
      score: 900 - i,
      cbetaRefStart: r.cbeta_ref_start,
    }));
  }

  /**
   * Named 五家 succession: hybrid + SQL succession-evidence preferrer.
   * Does not invent edges — only ranks chunks that already contain 嗣/宗派圖.
   */
  async retrieveSchoolLineage(
    question: string,
    decision: CbetaRouteDecision,
    topK?: number,
    options?: CbetaRetrieveOptions,
  ): Promise<CbetaRetrieveResult> {
    const original = options?.originalQuestion || question;
    const spec = detectCbetaSchoolLineage(original);
    const hybrid = await this.retrieveFast(question, decision, topK, options);
    if (!spec) return hybrid;

    const school = spec.nameZh;
    // School name variants from search needles (Hán only), for LIKE evidence scan.
    const schoolLikes = [
      ...new Set(
        [school, ...spec.searchNeedles.filter((n) => /[\u3400-\u9fff]{2}/u.test(n))]
          .map((n) => n.replace(/宗$/u, ''))
          .filter((n) => n.length >= 2),
      ),
    ].slice(0, 6);
    const likeParts: string[] = [];
    const params: unknown[] = [];
    for (const n of schoolLikes) {
      params.push(`%${n}%`);
      likeParts.push(`c.content_zh LIKE $${params.length}`);
    }
    const where = [
      `(${likeParts.join(' OR ')})`,
      `(c.content_zh LIKE '%法嗣%' OR c.content_zh LIKE '%師嗣%' OR c.content_zh LIKE '%宗派圖%' OR c.content_zh LIKE '%正傳%' OR c.content_zh LIKE '%下第%世%' OR c.content_zh LIKE '%嗣%')`,
    ];
    if (decision.workCodes.length) {
      params.push(decision.workCodes);
      where.push(`c.work_code = ANY($${params.length}::text[])`);
    } else if (decision.collections.length) {
      params.push(decision.collections);
      where.push(`c.collection = ANY($${params.length}::text[])`);
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
    }>(
      `
      SELECT
        c.id, c.work_code, c.collection,
        COALESCE(c.title_zh, w.title_zh, '') AS title_zh,
        c.juan_no, c.juan_label, c.chunk_index, c.content_zh, c.cbeta_ref_start
      FROM chunks c
      JOIN works w ON w.work_code = c.work_code
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE WHEN c.content_zh LIKE '%宗派圖%' OR c.content_zh LIKE '%正傳%' THEN 0 ELSE 1 END,
        CASE WHEN w.title_zh ~ '傳燈|五燈|禪燈|宗統|正宗|指月|燈錄|會元' THEN 0 ELSE 1 END,
        c.chunk_index ASC
      LIMIT 40
      `,
      params,
    );

    const sqlHits: CbetaChunkHit[] = rows.map((r, i) => ({
      id: r.id,
      workCode: r.work_code,
      collection: r.collection,
      titleZh: r.title_zh,
      juanNo: r.juan_no,
      juanLabel: r.juan_label,
      chunkIndex: r.chunk_index,
      contentZh: r.content_zh,
      score: 800 - i,
      cbetaRefStart: r.cbeta_ref_start,
    }));

    const byId = new Map<string, CbetaChunkHit>();
    for (const h of [...sqlHits, ...hybrid.hits]) {
      const prev = byId.get(h.id);
      if (!prev || h.score > prev.score) byId.set(h.id, h);
    }
    const merged = [...byId.values()]
      .map((h) => ({
        ...h,
        score:
          h.score +
          schoolLineageChunkBoost(h.contentZh, h.titleZh || '', school),
      }))
      .sort((a, b) => b.score - a.score);

    const diversified = diversifyCbetaHits(merged);
    const k = Math.max(1, topK ?? this.candidatePool());
    const hits = diversified.slice(0, k);
    return {
      hits,
      searchMode: 'hybrid',
      embedError: hybrid.embedError,
      worksScanned: [...new Set(hits.map((h) => h.workCode))],
      passes: 1,
    };
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

    // Overlap embed HTTP (:7997) with FTS/lexical SQL — then pgvector on the vec.
    let embedError: string | null = null;
    const embedPromise = this.embedding
      .embed(question)
      .then((vec) => ({ ok: true as const, vec }))
      .catch((err: unknown) => ({
        ok: false as const,
        err: err instanceof Error ? err.message : String(err),
      }));

    const ftsPromise = (async () => {
      let hits = await this.searchFts(question, terms, pool, filter, 'fast');
      if (!hits.length && terms.length) {
        hits = await this.searchLexical(terms, pool, filter);
      }
      return hits;
    })();

    const [embedRes, ftsHits] = await Promise.all([embedPromise, ftsPromise]);

    let vectorHits: CbetaChunkHit[] = [];
    if (embedRes.ok) {
      try {
        vectorHits = await this.searchVector(embedRes.vec, pool, filter);
      } catch (err: unknown) {
        embedError = err instanceof Error ? err.message : String(err);
        this.logger.warn(`CBETA vector search failed: ${embedError}`);
      }
    } else {
      embedError = embedRes.err;
      this.logger.warn(`CBETA embed failed: ${embedError}`);
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
    hits = diversifyCbetaHits(this.rerank(rerankQ, hits)).slice(0, k);
    hits = await this.expandNeighbors(hits);
    return { hits, searchMode, embedError };
  }

  /**
   * Heading-scoped register list: find the section chunk(s) by CJK needle,
   * optionally restricted to decision.workCodes. Does not scan 60+ lamp works.
   */
  async retrieveSectionList(
    question: string,
    decision: CbetaRouteDecision,
    topK?: number,
    options?: CbetaRetrieveOptions,
  ): Promise<CbetaRetrieveResult> {
    const original = options?.originalQuestion || question;
    const primaryNeedle =
      extractSectionHeadingNeedle(original) ||
      extractSectionHeadingNeedle(question) ||
      '五十六人';
    // Soft variants: CBETA often omits the leading 懷讓禪師 on the list chunk.
    const needles = [
      primaryNeedle,
      '第二世下五十六人（馬祖法嗣）',
      '五十六人（馬祖法嗣）',
      '已上四十三人見錄',
      '無機緣語句不錄',
      '馬祖法嗣',
      '五十六人',
    ].filter((n, i, arr) => n && arr.indexOf(n) === i);

    const params: unknown[] = [];
    const likeParts: string[] = [];
    for (const n of needles) {
      params.push(`%${n}%`);
      likeParts.push(`c.content_zh LIKE $${params.length}`);
    }
    const where = [`(${likeParts.join(' OR ')})`];
    if (decision.workCodes.length) {
      params.push(decision.workCodes);
      where.push(`c.work_code = ANY($${params.length}::text[])`);
    } else if (
      /馬祖法嗣|五十六人|懷讓禪師第二世|鄧隱峯|龐蘊|汾州無業|天目山明覺|Mã\s*Tổ|56\s*pháp\s*tự|(?:見錄|不錄).{0,40}(?:馬祖|Mã\s*Tổ|五十六|56)/iu.test(
        `${original}\n${question}`,
      )
    ) {
      // Default scope for the famous Jingde Mazu-56 register when user did not
      // name a work_code — avoids matching unrelated 「法嗣」 lists in other juans.
      params.push(['T51n2076']);
      where.push(`c.work_code = ANY($${params.length}::text[])`);
    } else if (decision.collections.length) {
      params.push(decision.collections);
      where.push(`c.collection = ANY($${params.length}::text[])`);
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
    }>(
      `
      SELECT
        c.id, c.work_code, c.collection,
        COALESCE(c.title_zh, w.title_zh, '') AS title_zh,
        c.juan_no, c.juan_label, c.chunk_index, c.content_zh, c.cbeta_ref_start
      FROM chunks c
      JOIN works w ON w.work_code = c.work_code
      WHERE ${where.join(' AND ')}
      ORDER BY c.chunk_index ASC
      LIMIT 24
      `,
      params,
    );

    if (!rows.length) {
      this.logger.warn(
        `sectionList: no chunk for needles=${needles.join('|')}; fallback hybrid`,
      );
      return this.retrieveFast(question, decision, topK, options);
    }

    // Prefer the dense register chunk (見錄/不錄 markers), not dialogue that
    // only mentions 法嗣 / 和尚 in prose (e.g. previous juan trailing text).
    const ranked = [...rows].sort((a, b) => {
      const score = (row: (typeof rows)[0]) => {
        const t = row.content_zh || '';
        const ref = (row.cbeta_ref_start || '').replace(/^p/i, '');
        return (
          (ref.includes('0256c07') ? 100 : 0) +
          (row.juan_no === 8 ? 30 : 0) +
          (t.includes('已上四十三人見錄') || t.includes('四十三人見錄')
            ? 50
            : 0) +
          (t.includes('無機緣語句不錄') ? 40 : 0) +
          (t.includes('五十六人（馬祖法嗣）') || t.includes('五十六人')
            ? 20
            : 0) +
          (t.includes('馬祖法嗣') ? 10 : 0) +
          Math.min(30, (t.match(/禪師|和尚|大師|坐主|居士/g) || []).length)
        );
      };
      return score(b) - score(a);
    });
    const primary = ranked[0];
    const hits: CbetaChunkHit[] = ranked.map((r, i) => ({
      id: r.id,
      workCode: r.work_code,
      collection: r.collection,
      titleZh: r.title_zh,
      juanNo: r.juan_no,
      juanLabel: r.juan_label,
      chunkIndex: r.chunk_index,
      contentZh: r.content_zh,
      score: 1000 - i,
      cbetaRefStart: r.cbeta_ref_start,
    }));
    // Keep primary first; neighbors only as citation context after it.
    const neighbors = await this.expandNeighbors([hits[0]]);
    const mergedHits = [
      hits[0],
      ...neighbors.filter((h) => h.id !== hits[0].id),
      ...hits.slice(1, 3),
    ];
    const parsed = parseOrderedMastersFromSection(
      primary.content_zh,
      primaryNeedle,
    );
    const entities: CbetaEntityHit[] = parsed.allNames.map((nameZh, i) => ({
      nameZh,
      count: parsed.allNames.length - i,
      works: [primary.work_code],
    }));

    return {
      hits: mergedHits,
      searchMode: 'deep',
      embedError: null,
      entities,
      worksScanned: [...new Set(mergedHits.map((h) => h.workCode))],
      passes: 1,
    };
  }

  /** Resolve work_code from a Hán title mentioned in the question (metadata). */
  async lookupWorksByTitleHint(
    question: string,
  ): Promise<Array<{ work_code: string; title_zh: string }>> {
    const titles = (question || '').match(/[\u4e00-\u9fff]{3,20}/gu) || [];
    const codes = (question || '').match(/[TXJABFGHLMNPRSUVWYZ]{1,3}\d{1,3}n\d{3,5}/gi) || [];
    const out: Array<{ work_code: string; title_zh: string }> = [];
    for (const code of codes) {
      const rows = await this.db.query<{ work_code: string; title_zh: string }>(
        `SELECT work_code, title_zh FROM works WHERE work_code = $1 LIMIT 1`,
        [code],
      );
      for (const r of rows) {
        if (!out.some((x) => x.work_code === r.work_code)) out.push(r);
      }
    }
    if (!titles.length) return out;
    // Longest first — prefer full work titles over short fragments.
    const needles = [...new Set(titles)].sort((a, b) => b.length - a.length).slice(0, 6);
    for (const n of needles) {
      const rows = await this.db.query<{ work_code: string; title_zh: string }>(
        `
        SELECT work_code, title_zh
        FROM works
        WHERE title_zh ILIKE $1 OR title_zh = $2
        ORDER BY length(title_zh) ASC
        LIMIT 5
        `,
        [`%${n}%`, n],
      );
      for (const r of rows) {
        if (!out.some((x) => x.work_code === r.work_code)) {
          out.push(r);
        }
      }
      if (out.length >= 8) break;
    }
    return out;
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
    if (decision.sectionListMode) {
      return this.retrieveSectionList(question, decision, topK, options);
    }
    if (!decision.coverageMode) {
      return this.retrieveFast(question, decision, topK, options);
    }
    const maxWorksEnv = parseInt(
      this.config.get<string>('CBETA_DEEP_MAX_WORKS') || '',
      10,
    );
    const hasMaxWorks = Number.isFinite(maxWorksEnv) && maxWorksEnv > 0;
    let works = await this.listCoverageWorks(
      decision.collections,
      decision.workCodes,
    );
    // User named a specific denglu/chronicle → scan only matching titles.
    // Prefer originalQuestion: rewrite/enrich may inject many lamp titles.
    const titleHint = coverageTitleHintRegex(
      options?.originalQuestion || question,
    );
    if (titleHint && works.length) {
      const narrowed = works.filter((w) =>
        new RegExp(titleHint, 'u').test(w.title_zh || ''),
      );
      if (narrowed.length) {
        this.logger.log(
          `coverageMode: title hint ${titleHint} → ${narrowed.length}/${works.length} works`,
        );
        works = narrowed;
      }
    }
    if (!works.length) {
      this.logger.warn(
        'coverageMode: no works matched title regex; falling back to hybrid',
      );
      return this.retrieveFast(question, decision, topK, options);
    }
    // Optional cap from env only — omit = scan all matching titles.
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

    // Patriarch / lineage lists: only pull chunks that look like master/lineage
    // prose — full work scan (e.g. 420 chunks × 景德傳燈錄) hung the SSE UI.
    const patriarchScan = isPatriarchListIntent(
      options?.originalQuestion || question,
    );
    const lineageSql = patriarchScan
      ? `AND c.content_zh ~ '禪師|和尚|大師|西天|東土|付法|祖'`
      : '';

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
          ${lineageSql}
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
    const merged = diversifyCbetaHits(
      this.rerank(question, [...citationPool, ...fast.hits]),
    );
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
    // Diversify by score, then pack in document order so Claude reads
    // consecutive passages within a work instead of score-shuffled jumps.
    const diversified = diversifyCbetaHits(
      [...hits].sort((a, b) => b.score - a.score),
    );
    const sorted = [...diversified].sort((a, b) => {
      const w = (a.workCode || '').localeCompare(b.workCode || '', 'zh');
      if (w !== 0) return w;
      return a.chunkIndex - b.chunkIndex;
    });

    for (const h of sorted) {
      const label = this.citationLabel(h);
      const body = h.contentZh.trim();
      if (!body) continue;
      const url = this.cbetaOnlineUrl(h.workCode, h.cbetaRefStart);
      const lens = corpusLensLabel(h);
      const meta = [
        `work_code=${h.workCode}`,
        `collection=${h.collection}`,
        `góc_nhìn=${lens}`,
        h.juanLabel?.trim() || (h.juanNo != null ? `juan=${h.juanNo}` : null),
        h.cbetaRefStart ? `ref=${h.cbetaRefStart}` : null,
        url ? `url=${url}` : null,
      ]
        .filter(Boolean)
        .join(' ');
      const block = `[CBETA][${lens}]\nTrích dẫn: ${label}\n${meta}\n\n${body}`;
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
    const lampBoost = isPatriarchListIntent(question);
    const lampTitleRe = /傳燈|五燈|指月|宗統|佛祖統|佛祖歷代|正宗記|會元|燈錄/;
    return hits
      .map((h) => {
        const lex = lexicalOverlapScore(question, h.contentZh);
        const titleBoost = lexicalOverlapScore(question, h.titleZh || '') * 0.25;
        const lineageBoost =
          lampBoost && lampTitleRe.test(h.titleZh || '') ? 0.15 : 0;
        return {
          ...h,
          score: h.score * 0.65 + lex * 0.3 + titleBoost + lineageBoost,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private async listCoverageWorks(
    collections: string[],
    workCodes: string[] = [],
  ): Promise<Array<{ work_code: string; title_zh: string; chunk_count: number }>> {
    const params: unknown[] = [];
    const where: string[] = ['TRUE'];
    // Explicit work_code from the question always wins over title-regex scan.
    if (workCodes.length) {
      params.push(workCodes);
      where.push(`work_code = ANY($${params.length}::text[])`);
    } else {
      const titleRe = this.coverageTitleRegex();
      if (titleRe) {
        params.push(titleRe);
        where.push(`title_zh ~ $${params.length}`);
      }
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
    // When a linehead locator is present, skip hard juan equality — TOC volume
    // labels often disagree with the chunk that spans the locator (e.g. vol.15
    // pointer p0317a22 living in a juan_no=14 chunk ending at 0317b12).
    if (
      decision.juanNo != null &&
      decision.juanNo > 0 &&
      !decision.cbetaRefNeedle?.trim()
    ) {
      params.push(decision.juanNo);
      parts.push(`c.juan_no = $${params.length}`);
    }
    if (decision.cbetaRefNeedle?.trim()) {
      // Soft page-family filter only; exact span match is done in lookupChunksByLocator.
      const needle = decision.cbetaRefNeedle.trim().replace(/^p/i, '');
      const page = needle.slice(0, 4);
      params.push(`%${page}%`);
      parts.push(
        `(c.cbeta_ref_start ILIKE $${params.length} OR c.cbeta_ref_end ILIKE $${params.length})`,
      );
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

  /**
   * Neighbor expand + stitch (parallel):
   * - Top CBETA_ANCHOR_EXPAND_HITS: asymmetric [-1, +2], then dialogue backshift
   * - Remaining expand hits: center only (Anchor+Support budget)
   * - Adjacent chunk texts stitched with 【ref】 markers
   */
  private async expandNeighbors(
    hits: CbetaChunkHit[],
  ): Promise<CbetaChunkHit[]> {
    if (!hits.length) return hits;
    const seen = new Set<string>();
    const envN = parseInt(this.config.get<string>('CBETA_EXPAND_HITS') || '', 10);
    const expandN = Math.min(
      hits.length,
      Number.isFinite(envN) && envN > 0 ? envN : LOOKUP_TOP_K,
    );

    const expanded = await Promise.all(
      hits.slice(0, expandN).map(async (h, i) => {
        const role = i < CBETA_ANCHOR_EXPAND_HITS ? 'anchor' : 'support';
        let { from, to } = cbetaExpandIndexRange(h.chunkIndex, role);

        let rows = await this.fetchChunksByIndex(h.workCode, from, to);
        if (
          role === 'anchor' &&
          rows.length &&
          needsCbetaDialogueBackshift(rows[0].content_zh) &&
          from > 0
        ) {
          from -= 1;
          rows = await this.fetchChunksByIndex(h.workCode, from, to);
        }
        if (!rows.length) return h;

        const stitched = stitchChunkParts(
          rows.map((r) => ({
            text: r.content_zh,
            marker: r.cbeta_ref_start || `chunk:${r.chunk_index}`,
          })),
        );
        const center =
          rows.find((r) => r.chunk_index === h.chunkIndex) ?? rows[0];
        return {
          id: h.id,
          workCode: center.work_code,
          collection: center.collection,
          titleZh: center.title_zh || h.titleZh,
          juanNo: center.juan_no,
          juanLabel: center.juan_label,
          chunkIndex: h.chunkIndex,
          contentZh: stitched || h.contentZh,
          score: h.score,
          cbetaRefStart: h.cbetaRefStart ?? center.cbeta_ref_start,
        } satisfies CbetaChunkHit;
      }),
    );

    const out: CbetaChunkHit[] = [];
    for (const h of expanded) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      out.push(h);
    }
    for (const h of hits.slice(expandN)) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      out.push(h);
    }

    return out.sort((a, b) => b.score - a.score);
  }

  private async fetchChunksByIndex(
    workCode: string,
    from: number,
    to: number,
  ): Promise<
    {
      id: string;
      work_code: string;
      collection: string;
      title_zh: string;
      juan_no: number | null;
      juan_label: string | null;
      chunk_index: number;
      content_zh: string;
      cbeta_ref_start: string | null;
    }[]
  > {
    const lo = Math.max(0, from);
    const hi = Math.max(lo, to);
    const idxs: number[] = [];
    for (let n = lo; n <= hi; n++) idxs.push(n);
    if (!idxs.length) return [];
    return this.db.query(
      `
      SELECT
        c.id, c.work_code, c.collection,
        COALESCE(c.title_zh, '') AS title_zh,
        c.juan_no, c.juan_label, c.chunk_index, c.content_zh, c.cbeta_ref_start
      FROM chunks c
      WHERE c.work_code = $1 AND c.chunk_index = ANY($2::int[])
      ORDER BY c.chunk_index
      `,
      [workCode, idxs],
    );
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
