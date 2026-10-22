# Changes implemented

## Code (NestJS CBETA RAG)

| File | Change |
|---|---|
| `cbeta-intent.util.ts` | Fix `傳燈錄.*祖` false-positive; add `isCbetaSectionListIntent` |
| `cbeta-router.ts` / `cbeta.types.ts` | New `sectionListMode` route flag |
| `cbeta-section-list.util.ts` (+ tests) | Parse ordered 見錄/不錄; format deterministic answer |
| `cbeta-retrieve.service.ts` | `retrieveSectionList`; honor `workCodes` in coverage list; `lookupWorksByTitleHint` |
| `cbeta-chat.service.ts` | Section + work-catalog deterministic answers; lineage Hán alias hint |
| `cbeta-preprocess.util.ts` | Skip patriarch bag for section intents |

## Harness

| File | Change |
|---|---|
| `rag_test_results/run_rag_qa_eval.py` | TEST04 alias-aware edge matching (道一≈馬祖, …) |

## Not done (intentionally)

- No re-embed / re-index.
- No hardcoded 56-name ground truth in production code.
- No production (non-demo) deploy.
