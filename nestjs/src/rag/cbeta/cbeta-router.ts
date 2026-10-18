import type { CbetaCorpus, CbetaPath, CbetaRouteDecision } from './cbeta.types';

const COVERAGE_RE =
  /liệt\s*kê|toàn\s*bộ|danh\s*sách|các\s*vị\s*tổ|những\s*vị\s*tổ|ngũ\s*gia|thất\s*tông|truyền\s*thừa.*(liệt|danh)|enumerate|list\s+all/i;

const MASTER_COLLECTION: Array<{ re: RegExp; code: string }> = [
  { re: /虛雲|hư\s*vân|xuyun/i, code: 'XY' },
  { re: /來果|lai\s*quả|laiguo/i, code: 'LQ' },
];

export interface RouteInput {
  question: string;
  corpus?: CbetaCorpus | string | null;
  /** Hard collection filter from dedicated CBETA API. */
  collections?: string[] | null;
  /** Force path from dedicated CBETA API. */
  forcePath?: CbetaPath | null;
}

/**
 * B0 router for dedicated `/api/cbeta/*` only (always corpus=cbeta).
 * Deep when coverage keywords (or forcePath=deep).
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
  for (const m of MASTER_COLLECTION) {
    if (m.re.test(q) && !seen.has(m.code)) {
      seen.add(m.code);
      collections.push(m.code);
    }
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

  const scopeNote =
    path === 'deep'
      ? 'CBETA coverage: ưu tiên truyền đăng / ngũ đăng / chỉ nguyệt; ghi rõ phạm vi đã quét.'
      : collections.length
        ? `CBETA filter collection: ${collections.join(', ')}`
        : 'CBETA semantic hybrid (toàn kho; có filter nếu client gửi collections).';

  return {
    corpus: 'cbeta',
    resolvedCorpus: 'cbeta',
    path,
    collections,
    workCodes: [],
    scopeNote,
    reasons,
  };
}
