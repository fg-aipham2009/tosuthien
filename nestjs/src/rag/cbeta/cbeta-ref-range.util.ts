/**
 * CBETA linehead / page-line refs (e.g. 0317a22, p0317a22).
 * Chunks store a start–end span; a user locator may fall inside that span.
 */

const REF_RE = /^p?(\d{3,4})([abc])(\d{1,2})$/i;

/** Normalize to comparable form: 4-digit page + a|b|c + 2-digit line. */
export function normalizeCbetaRef(ref: string | null | undefined): string | null {
  const raw = (ref || '').trim().replace(/^p/i, '');
  if (!raw) return null;
  const m = raw.match(REF_RE);
  if (!m) return null;
  return `${m[1].padStart(4, '0')}${m[2].toLowerCase()}${m[3].padStart(2, '0')}`;
}

/**
 * True when needle is the start ref, or lies within [start, end] (inclusive).
 * If end is missing, only exact/start-prefix match applies via normalize equality.
 */
export function cbetaRefCovers(
  start: string | null | undefined,
  end: string | null | undefined,
  needle: string | null | undefined,
): boolean {
  const n = normalizeCbetaRef(needle);
  const s = normalizeCbetaRef(start);
  if (!n || !s) return false;
  if (s === n) return true;
  const e = normalizeCbetaRef(end) || s;
  return s <= n && n <= e;
}

/** Strip leading p for SQL / display needles. */
export function bareCbetaRef(ref: string | null | undefined): string {
  return (ref || '').trim().replace(/^p\.?/i, '');
}
