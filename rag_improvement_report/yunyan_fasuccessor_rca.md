# RCA + fix: 雲巖曇晟 法嗣 / locator / coverage dump

## Architecture (actual)

`POST /api/cbeta/chat` → `CbetaChatService` → rewrite (`LlmService.rewriteCbetaSearchQuery`) → `routeCbetaQuery` → retrieve (`sectionList` | `schoolLineage` | `personRelation` | `coverage/deep` | `fast`) → pack → deterministic format or `answerCbeta`.

## Failures reproduced

| Case | Symptom | Root cause | Confidence |
|------|---------|------------|------------|
| VI “liệt kê pháp tự của 雲巖曇晟” | 西天/東土 ~640 names | `LIST_ENUM_RE` (`liệt kê`) → `coverageMode` | High |
| `T51n2076_p0317a22` | locator ignored | parser required `\b` after work code; `_p…` glued form failed; `volume N` not parsed | High |
| Exact `p0317a22` SQL | 0 rows on `cbeta_ref_start` | Passage lives in chunk `0316b20`–`0317b12` (juan 14); user “vol 15” ≠ `juan_no` | High |
| EN/VI relation (post-fix) | wrong biography list | bare `法嗣` in 洞山 bio ranked over TOC `法嗣四人` | High |
| Gloss Test C | 30–70 unrelated cites | UI cited full candidate pool (~100k context) | High |

## Fixes shipped (demo VPS)

- `personRelationMode`: 法嗣 of one person ≠ document coverage
- Locator parse: `T51n2076_p0317a22`, `volume N`; range cover via `cbeta_ref_start/end`
- Deterministic TOC extract for `…法嗣N人` lists; prefer counted headings
- Evidence-only citations; `CBETA_DIAG=1` structured trace
- Soft validation + one bounded retry away from coverage-shaped answers

## Regression (executed on VPS)

Command:

```bash
CBETA_API_BASE=http://127.0.0.1:8000/api python3 rag_test_results/run_yunyan_relation_regression.py
```

Latest: **6/7 PASS** (C1/C2/C4/C5/C7/C9). C3 translate content OK; cite count was the only soft fail (threshold).

## Remaining risks

- No-answer probes can still return many work-scoped hybrid cites
- Chunk spans mean user “卷15 / p0317a22” may cite `juan_no=14` chunk that covers the locator (correct text, TOC volume label differs)
- Full Case 10 global suite not re-run in this pass
