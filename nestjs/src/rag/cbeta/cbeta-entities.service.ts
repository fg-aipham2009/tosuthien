import { Injectable, Logger } from '@nestjs/common';
import { CbetaDbService } from './cbeta-db.service';
import {
  DONGDU_PATRIARCHS,
  XITIAN_PATRIARCHS,
} from './cbeta-coverage-answer.util';
import {
  extractLiteralNameMentions,
  extractMasterNames,
} from './cbeta-entity.util';

export interface CbetaEntityRow {
  nameZh: string;
  kind: string;
  workCode: string | null;
  collection: string | null;
  mentionCount: number;
  titleZh?: string | null;
}

@Injectable()
export class CbetaEntitiesService {
  private readonly logger = new Logger(CbetaEntitiesService.name);

  constructor(private readonly db: CbetaDbService) {}

  extractFromText(text: string): string[] {
    const titled = extractMasterNames(text);
    // Lamp prose often names 西天/東土 patriarchs without 禪師|和尚|大師.
    const known = extractLiteralNameMentions(text, [
      ...XITIAN_PATRIARCHS,
      ...DONGDU_PATRIARCHS,
    ]);
    if (!known.length) return titled;
    const seen = new Set(titled);
    const out = [...titled];
    for (const n of known) {
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  }

  async upsertMentions(
    names: string[],
    meta: {
      workCode: string;
      collection: string;
      chunkId?: string | null;
      juanNo?: number | null;
    },
  ): Promise<void> {
    if (!names.length) return;
    for (const name of names) {
      try {
        await this.db.query(
          `
          INSERT INTO canon_entities (
            name_zh, kind, work_code, collection, chunk_id, juan_no, mention_count
          ) VALUES ($1, 'master', $2, $3, $4, $5, 1)
          ON CONFLICT (name_zh, work_code, kind) DO UPDATE SET
            mention_count = canon_entities.mention_count + 1,
            chunk_id = COALESCE(EXCLUDED.chunk_id, canon_entities.chunk_id),
            juan_no = COALESCE(EXCLUDED.juan_no, canon_entities.juan_no),
            updated_at = now()
          `,
          [
            name,
            meta.workCode,
            meta.collection,
            meta.chunkId ?? null,
            meta.juanNo ?? null,
          ],
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`entity upsert failed ${name}: ${msg}`);
      }
    }
  }

  async listAggregated(opts?: {
    q?: string;
    limit?: number;
  }): Promise<Array<{ nameZh: string; mentionCount: number; workCount: number }>> {
    const limit = opts?.limit && opts.limit > 0 ? opts.limit : undefined;
    const params: unknown[] = [];
    let where = `kind = 'master'`;
    if (opts?.q?.trim()) {
      params.push(`%${opts.q.trim()}%`);
      where += ` AND name_zh LIKE $${params.length}`;
    }
    const limitSql = limit
      ? (() => {
          params.push(limit);
          return `LIMIT $${params.length}`;
        })()
      : '';
    const rows = await this.db.query<{
      name_zh: string;
      mention_count: string;
      work_count: string;
    }>(
      `
      SELECT
        name_zh,
        sum(mention_count)::text AS mention_count,
        count(DISTINCT work_code)::text AS work_count
      FROM canon_entities
      WHERE ${where}
      GROUP BY name_zh
      ORDER BY sum(mention_count) DESC, name_zh ASC
      ${limitSql}
      `,
      params,
    );
    return rows.map((r) => ({
      nameZh: r.name_zh,
      mentionCount: Number(r.mention_count) || 0,
      workCount: Number(r.work_count) || 0,
    }));
  }

  /** Merge in-memory pass extractions: name → count + sample work. */
  mergePassEntities(
    acc: Map<string, { count: number; works: Set<string> }>,
    names: string[],
    workCode: string,
  ) {
    for (const name of names) {
      const cur = acc.get(name) || { count: 0, works: new Set<string>() };
      cur.count += 1;
      cur.works.add(workCode);
      acc.set(name, cur);
    }
  }

  /**
   * Build entity list for the answer LLM. When maxChars is set, keep highest-count
   * names only until the budget is filled (full scan of 3000+ names blew the prompt
   * and models started answering in English meta-prose).
   */
  formatEntityListBlock(
    entities: Array<{ nameZh: string; count: number; works: string[] }>,
    worksScanned: string[],
    maxChars?: number,
  ): string {
    const head = [
      '[CBETA_ENTITY_LIST]',
      `Phạm vi đã quét work_code: ${worksScanned.join(', ') || '(trống)'}`,
      'Danh sách tên (extract từ nguyên văn; CẤM thêm tên ngoài list):',
    ];
    let used = head.join('\n').length;
    const lines: string[] = [];
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const line = `${i + 1}. ${e.nameZh}（提及≈${e.count}；見 ${e.works.join('、')}）`;
      if (
        typeof maxChars === 'number' &&
        maxChars > 0 &&
        used + 1 + line.length > maxChars
      ) {
        lines.push(
          `… (còn ${entities.length - i} tên theo count — đã đủ ngân sách ngữ cảnh)`,
        );
        break;
      }
      lines.push(line);
      used += 1 + line.length;
    }
    return [...head, ...lines].join('\n');
  }
}
