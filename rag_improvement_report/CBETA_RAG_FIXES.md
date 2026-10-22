# CBETA RAG — Fixes

## Feature flags (default OFF)

| Env | Effect |
|-----|--------|
| `CBETA_MULTI_WORK_RETRIEVAL` | Independent per-work scripture retrieve + round-robin merge + `meta.workDiagnostics` |
| `CBETA_QUOTE_LEVEL_CITATIONS` | Extra citation fields: `chunk_*` / `quote_*` locators, `locatorPrecision`, `evidenceId` (passage-level until TEI char maps exist) |
| `CBETA_QUOTE_VERIFY_V2` | Align fenced quotes to evidence (indel-only), bounded phrase re-lookup, then existing doctrinal gate |

Documented in `.env.example`. Existing `CBETA_STRICT_VERIFY` behavior preserved when V2 is off.

## Algorithms

### Multi-work (`cbeta-retrieve.service.ts`)

When flag on and `decision.workCodes.length >= 2`:

1. For each work: `isWorkIndexed` → else `work_not_indexed`.
2. `retrieveScriptureGroundedSingle` with that work only.
3. Round-robin merge up to `topK` so one work cannot wipe another.
4. Diagnostics: `ok` | `work_not_indexed` | `no_matching_passage`.

### Hard work constraint (`cbeta-evidence.util.ts`)

`explicitWorkCodes` from decision + question. When non-empty, phrase refine **never** falls through to another work (fixes `T08n0235`→`T08n0236a`).  
When ≥2 named works: `selectMultiWorkPhraseHits` keeps per-work evidence.

### Quote locators (`cbeta-quote-locator.util.ts` + `toCitations`)

If phrase found in chunk: attach locators from chunk refs, `locatorPrecision: 'passage'`.  
Never invent mid-chunk lineheads.

### Verify V2 (`cbeta-quote-align.util.ts` + chat)

1. `repairAnswerQuotesFromEvidence` — indel-only align (e.g. restore `得`).
2. If still unsupported: `lookupPhrasesBounded` within named works.
3. Re-run `applyDoctrinalGateToAnswer` (fabrications still stripped).

## Compatibility

- `/api/cbeta/chat` and `/stream` response shape unchanged for existing fields.
- New citation/meta fields are additive and omitted when flags off.
- No index rebuild, no prod DB writes, no auto-deploy.

## Known limitations

- Quote-exact CBETA lineheads need TEI character maps (not in chunk schema today).
- Multi-work flag must be enabled to get independent SQL passes (hard constraint on cites still applies without it).
- Indel align allows ≤2 insertions/deletions only; will not “verify” paraphrases.
