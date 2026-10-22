import {
  isCbetaCoverageIntent,
  isCbetaPersonRelationIntent,
  isCbetaSchoolLineageIntent,
  isCbetaSectionListIntent,
} from './cbeta-intent.util';
import {
  isCbetaQuoteVerifyIntent,
  isCbetaScriptureExplainIntent,
} from './cbeta-scripture-intent.util';
import type { CbetaCorpus, CbetaPath, CbetaRouteDecision } from './cbeta.types';

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
  // Section register (馬祖法嗣…) wins over global patriarch coverage.
  const sectionList = isCbetaSectionListIntent(q);
  // Named 五家 school succession — not coverage dump.
  const schoolLineage = !sectionList && isCbetaSchoolLineageIntent(q);
  // One person's 法嗣 / Dharma successors — not 西天/東土 coverage dump.
  const personRelation =
    !sectionList && !schoolLineage && isCbetaPersonRelationIntent(q);
  const quoteVerify =
    !sectionList &&
    !schoolLineage &&
    !personRelation &&
    isCbetaQuoteVerifyIntent(q);
  const scriptureExplain =
    !sectionList &&
    !schoolLineage &&
    !personRelation &&
    !quoteVerify &&
    isCbetaScriptureExplainIntent(q);
  // Not bare "toàn bộ kinh sách" — that is essence/summary, not list coverage.
  const coverage =
    !sectionList &&
    !schoolLineage &&
    !personRelation &&
    !quoteVerify &&
    !scriptureExplain &&
    isCbetaCoverageIntent(q);

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
  } else if (sectionList) {
    path = 'deep';
    reasons.push('sectionList→deep');
  } else if (schoolLineage) {
    // Deep flag for logging; retrieve uses schoolLineageMode hybrid path.
    path = 'deep';
    reasons.push('schoolLineage→deep');
  } else if (personRelation) {
    path = 'fast';
    reasons.push('personRelation→fast');
  } else if (quoteVerify || scriptureExplain) {
    path = 'fast';
    reasons.push(quoteVerify ? 'quoteVerify→fast' : 'scriptureExplain→fast');
  } else if (coverage) {
    path = 'deep';
    reasons.push('coverage→deep');
  } else {
    reasons.push('default→fast');
  }

  const coverageMode = coverage;
  const sectionListMode = sectionList;
  const schoolLineageMode = schoolLineage;
  const personRelationMode = personRelation;
  const quoteVerifyMode = quoteVerify;
  const scriptureExplainMode = scriptureExplain;
  if (coverageMode) reasons.push('coverageMode');
  if (sectionListMode) reasons.push('sectionListMode');
  if (schoolLineageMode) reasons.push('schoolLineageMode');
  if (personRelationMode) reasons.push('personRelationMode');
  if (quoteVerifyMode) reasons.push('quoteVerifyMode');
  if (scriptureExplainMode) reasons.push('scriptureExplainMode');

  const scopeParts = [`path=${path}`];
  if (coverageMode) scopeParts.push('mode=coverage');
  if (sectionListMode) scopeParts.push('mode=sectionList');
  if (schoolLineageMode) scopeParts.push('mode=schoolLineage');
  if (personRelationMode) scopeParts.push('mode=personRelation');
  if (quoteVerifyMode) scopeParts.push('mode=quoteVerify');
  if (scriptureExplainMode) scopeParts.push('mode=scriptureExplain');
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
    sectionListMode,
    schoolLineageMode,
    personRelationMode,
    quoteVerifyMode,
    scriptureExplainMode,
    scopeNote: scopeParts.join('; '),
    reasons,
  };
}
