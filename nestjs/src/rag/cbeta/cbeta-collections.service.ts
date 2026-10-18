import { Injectable } from '@nestjs/common';
import { CbetaDbService } from './cbeta-db.service';
import type { CbetaCollectionAlias } from './cbeta-router';

@Injectable()
export class CbetaCollectionsService {
  constructor(private readonly db: CbetaDbService) {}

  /**
   * Aliases for router collection filter: explicit rows + collection names.
   * All data from DB `cbeta` — no Nest hardcode map.
   */
  async listRouteAliases(): Promise<CbetaCollectionAlias[]> {
    if (!this.db.isConfigured()) return [];
    const rows = await this.db.query<{ code: string; alias: string }>(
      `
      SELECT collection_code AS code, alias
      FROM collection_aliases
      WHERE trim(alias) <> ''
      UNION
      SELECT code, name_zh AS alias
      FROM collections
      WHERE coalesce(trim(name_zh), '') <> ''
      UNION
      SELECT code, name_vi AS alias
      FROM collections
      WHERE coalesce(trim(name_vi), '') <> ''
      `,
    );
    return rows
      .map((r) => ({
        code: (r.code || '').trim().toUpperCase(),
        alias: (r.alias || '').trim(),
      }))
      .filter((r) => r.code && r.alias);
  }
}
