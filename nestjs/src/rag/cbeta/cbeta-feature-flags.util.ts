/**
 * Feature flags for CBETA retrieval / citation / verify increments.
 * Default OFF — enable via env for staged validation.
 */

function envOn(name: string): boolean {
  const v = (process.env[name] || '').toString().trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

/** Independent retrieve + merge when question names 2+ work IDs. */
export function cbetaMultiWorkRetrievalEnabled(): boolean {
  return envOn('CBETA_MULTI_WORK_RETRIEVAL');
}

/**
 * Attach quote-oriented locator metadata on citations (passage vs quote_approx).
 * Does not invent lineheads beyond chunk mapping.
 */
export function cbetaQuoteLevelCitationsEnabled(): boolean {
  return envOn('CBETA_QUOTE_LEVEL_CITATIONS');
}

/**
 * Before stripping “unverified” quotes: align to exact evidence spans
 * (incl. 1-char indel repair) and bounded re-check.
 */
export function cbetaQuoteVerifyV2Enabled(): boolean {
  return envOn('CBETA_QUOTE_VERIFY_V2');
}
