/**
 * Build lexical / FTS terms from a search string + optional rewrite keywords.
 * No fixed vocabulary — CJK runs + character n-grams from data/query only.
 */

export function parseNgramSizes(envValue: string | undefined): number[] {
  const raw = (envValue || '').trim();
  if (!raw) return [2, 3];
  const sizes = raw
    .split(/[,\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n >= 2);
  return sizes.length ? [...new Set(sizes)].sort((a, b) => a - b) : [2, 3];
}

/** Escape a token for PostgreSQL to_tsquery (simple). */
export function escapeTsQueryTerm(term: string): string | null {
  const t = term.trim();
  if (!t) return null;
  // Drop chars that break tsquery syntax.
  const cleaned = t.replace(/['|&!:*()<>]/g, '').trim();
  if (!cleaned) return null;
  return cleaned.replace(/\\/g, '\\\\');
}

/**
 * Collect unique lexical terms: whitespace tokens, CJK runs, and n-grams.
 */
export function extractLexicalTerms(
  text: string,
  extraKeywords: string[] = [],
  ngramSizes: number[] = [2, 3],
): string[] {
  const out = new Set<string>();

  const add = (s: string) => {
    const t = (s || '').trim();
    if (t.length >= 2) out.add(t);
  };

  for (const k of extraKeywords) add(k);

  const q = (text || '').normalize('NFC');
  for (const part of q.split(/\s+/)) add(part);

  const runs = q.match(/[\u4e00-\u9fff]+/g) || [];
  for (const run of runs) {
    add(run);
    for (const n of ngramSizes) {
      if (run.length < n) continue;
      for (let i = 0; i + n <= run.length; i++) {
        add(run.slice(i, i + n));
      }
    }
  }

  return [...out];
}

/** OR-tsquery string for simple config, or null if no valid terms. */
export function buildOrTsQuery(terms: string[]): string | null {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    // Split on whitespace — "諸惡莫作 眾善奉行" must not become one tsquery token.
    for (const piece of (term || '').split(/\s+/)) {
      const esc = escapeTsQueryTerm(piece);
      if (!esc || seen.has(esc)) continue;
      seen.add(esc);
      parts.push(esc);
    }
  }
  if (!parts.length) return null;
  return parts.join(' | ');
}
