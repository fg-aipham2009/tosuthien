/**
 * Parse explicit CBETA citation hints from the user question
 * (work_code / juan / linehead) before vector search.
 */

export interface CbetaCitationHints {
  workCodes: string[];
  /** Juan number when user said 卷N / quyển N. */
  juanNo: number | null;
  /**
   * Needle for cbeta_ref_start, e.g. "p0292" or "0292c16".
   * Matched with SQL ILIKE / regex — not invented refs.
   */
  cbetaRefNeedle: string | null;
  reasons: string[];
}

/**
 * Work code, optionally glued to a linehead: T51n2076 or T51n2076_p0317a22.
 * Underscore form must be parsed before bare work-code (no \b after digits+_).
 */
const WORK_WITH_LINEHEAD_RE =
  /\b([TXAJHKLSNDtxajhklsnd])\s*(\d{1,2})\s*n\s*(\d{3,4})([a-zA-Z]?)(?:_p?(\d{3,4}[abc]\d{1,2}))?\b|\b([TXAJHKLSNDtxajhklsnd])(\d{4})([a-zA-Z]?)(?:_p?(\d{3,4}[abc]\d{1,2}))?\b/gi;

const JUAN_RE =
  /(?:卷|劵|第)\s*([0-9]{1,3})|quyển\s*([0-9]{1,3})|juan\s*([0-9]{1,3})|vol(?:ume|\.)?\s*([0-9]{1,3})/gi;

/** CBETA linehead p0292c16 or compact 0292c16 */
const LINEHEAD_RE = /\b(p?\d{3,4}[abc]\d{1,2})\b/gi;

/** Vietnamese / Chinese "page N" → pad into p0xxx needle */
const PAGE_NUM_RE =
  /(?:trang|頁|页)\s*([0-9]{1,4})|p\.?\s*([0-9]{3,4})\b/gi;

export function parseCbetaCitationHints(question: string): CbetaCitationHints {
  const q = (question || '').normalize('NFC');
  const workCodes: string[] = [];
  const seen = new Set<string>();
  const reasons: string[] = [];
  let cbetaRefNeedle: string | null = null;

  for (const m of q.matchAll(WORK_WITH_LINEHEAD_RE)) {
    let code: string;
    let gluedRef: string | undefined;
    if (m[1] && m[2] && m[3]) {
      code = `${m[1].toUpperCase()}${m[2]}n${m[3]}${(m[4] || '').toLowerCase()}`;
      gluedRef = m[5];
    } else if (m[6] && m[7]) {
      // T2005 → keep as T2005 (works table may store Txxxx or Tnnxxxx)
      code = `${m[6].toUpperCase()}${m[7]}${(m[8] || '').toLowerCase()}`;
      gluedRef = m[9];
    } else {
      continue;
    }
    if (!seen.has(code)) {
      seen.add(code);
      workCodes.push(code);
      reasons.push(`work_code=${code}`);
    }
    if (gluedRef && !cbetaRefNeedle) {
      const raw = gluedRef.toLowerCase();
      cbetaRefNeedle = raw.startsWith('p') ? raw : `p${raw}`;
      reasons.push(`ref=${cbetaRefNeedle}`);
    }
  }

  let juanNo: number | null = null;
  for (const m of q.matchAll(JUAN_RE)) {
    const n = parseInt(m[1] || m[2] || m[3] || m[4] || '', 10);
    if (Number.isFinite(n) && n > 0) {
      juanNo = n;
      reasons.push(`juan=${n}`);
      break;
    }
  }

  if (!cbetaRefNeedle) {
    for (const m of q.matchAll(LINEHEAD_RE)) {
      const raw = (m[1] || '').toLowerCase();
      cbetaRefNeedle = raw.startsWith('p') ? raw : `p${raw}`;
      reasons.push(`ref=${cbetaRefNeedle}`);
      break;
    }
  }
  if (!cbetaRefNeedle) {
    for (const m of q.matchAll(PAGE_NUM_RE)) {
      const n = parseInt(m[1] || m[2] || '', 10);
      if (!Number.isFinite(n) || n <= 0) continue;
      const padded = String(n).padStart(4, '0');
      cbetaRefNeedle = `p${padded}`;
      reasons.push(`page→${cbetaRefNeedle}`);
      break;
    }
  }

  return { workCodes, juanNo, cbetaRefNeedle, reasons };
}

/** Keep every CJK run from the raw question so rewrite cannot drop them. */
export function extractPreservedCjk(question: string): string[] {
  const found = (question || '').match(/[\u4e00-\u9fff]{2,24}/g) || [];
  return [...new Set(found)];
}
