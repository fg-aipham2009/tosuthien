import type { CbetaCorpus, CbetaPath, CbetaRouteDecision } from './cbeta.types';

const COVERAGE_RE =
  /liệt\s*kê|toàn\s*bộ|danh\s*sách|các\s*vị\s*tổ|những\s*vị\s*tổ|ngũ\s*gia|thất\s*tông|truyền\s*thừa.*(liệt|danh)|enumerate|list\s+all/i;

export interface CbetaCollectionAlias {
  code: string;
  alias: string;
}

export interface RouteInput {
  question: string;
  corpus?: CbetaCorpus | string | null;
  /** Hard collection filter from dedicated CBETA API. */
  collections?: string[] | null;
  /** Force path from dedicated CBETA API. */
  forcePath?: CbetaPath | null;
  /** Loaded from DB `collection_aliases` (+ collection names). */
  aliases?: CbetaCollectionAlias[] | null;
}

/** Match question against a DB alias (CJK substring or flexible Latin/VI whitespace). */
export function aliasMatchesQuestion(question: string, alias: string): boolean {
  const q = (question || '').normalize('NFC');
  const a = (alias || '').normalize('NFC').trim();
  if (!q || !a) return false;
  if (/[\u4e00-\u9fff]/.test(a)) {
    return q.includes(a);
  }
  const escaped = a
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  return new RegExp(escaped, 'i').test(q);
}

/**
 * B0 router for dedicated `/api/cbeta/*` only (always corpus=cbeta).
 * Deep when coverage keywords (or forcePath=deep).
 * Collection auto-filter only from DB aliases — never a Nest name→code map.
 */
export function routeCbetaQuery(input: RouteInput): CbetaRouteDecision {
  const q = (input.question || '').trim();
  const reasons: string[] = ['api=cbeta'];
  const coverage = COVERAGE_RE.test(q);

  const collections: string[] = [];
  const seen = new Set<string>();
  for (const code of input.collections || []) {
    const c = (code || '').trim().toUpperCase();
    if (c && !seen.has(c)) {
      seen.add(c);
      collections.push(c);
    }
  }
  for (const row of input.aliases || []) {
    const code = (row.code || '').trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    if (!aliasMatchesQuestion(q, row.alias)) continue;
    seen.add(code);
    collections.push(code);
    reasons.push(`alias→${code}`);
  }

  let path: CbetaPath = 'fast';
  if (input.forcePath === 'fast' || input.forcePath === 'deep') {
    path = input.forcePath;
    reasons.push(`forcePath=${path}`);
  } else if (coverage) {
    path = 'deep';
    reasons.push('coverage→deep');
  } else {
    reasons.push('default→fast');
  }

  const coverageMode = coverage;
  if (coverageMode) reasons.push('coverageMode');

  const scopeParts = [`path=${path}`];
  if (coverageMode) scopeParts.push('mode=coverage');
  scopeParts.push(
    collections.length
      ? `collections=${collections.join(',')}`
      : 'collections=none',
  );

  return {
    corpus: 'cbeta',
    resolvedCorpus: 'cbeta',
    path,
    collections,
    workCodes: [],
    juanNo: null,
    cbetaRefNeedle: null,
    coverageMode,
    scopeNote: scopeParts.join('; '),
    reasons,
  };
}
