# CBETA RAG — Benchmark / regression notes

## Dataset

Seven previously examined cases (helpers + parse/evidence/align unit tests).  
These are **not** promoted to verified gold accuracy percentages.

| Case | Focus | Automated coverage |
|------|--------|-------------------|
| 01 | Wrong translation `T08n0235` | `cbeta-case-regression.util.test.ts`, `cbeta-multi-work.util.test.ts` |
| 02 | Quote locator `T30n1564` | locateQuoteInHits |
| 03 | Work/verse `T09n0262` | locateQuoteInHits prefers containing chunk |
| 04 | Verbatim fidelity / `得` | `cbeta-quote-align.util.test.ts` |
| 05 | False reject / volume cue | verifyAnswerQuotesAgainstEvidence + locate |
| 06 | Multi-work + false reject | explicitWorkCodes + selectEvidenceHits |
| 07 | `T48n2007`+`T48n2008` | parse + multi-work evidence |

## Unit suite (local)

```bash
cd nestjs && npm run test:cbeta
```

Result after this increment: **148 pass / 0 fail** (includes new flag / multi-work / align / seven-case tests).

## Metrics policy

Do **not** treat manual case scores as ground-truth %.  
Paired before/after E2E (same questions, same `CBETA_*` flags, same model) should be recorded when demo-validated:

| Metric | Baseline (pre-change) | After (flags on) | Notes |
|--------|----------------------|------------------|-------|
| Correct-work retrieval | — | — | Fill on demo with MULTI_WORK=1 |
| Multi-work evidence coverage | — | — | Cases 06–07 |
| False quote rejection rate | — | — | Cases 05–06 with VERIFY_V2=1 |
| Unsupported quote acceptance | — | — | Must stay ~0 under STRICT_VERIFY |
| p50 / p95 latency | — | — | Multi-work adds one retrieve pass per work ID |

## Failure examples (pre-fix, qualitative)

- Case 01: cited `T08n0236a` while user asked `T08n0235`.
- Case 05/06: valid fenced quotes stripped despite CBETA text in corpus.
- Agama: model wrote `不樂故解脫`; evidence had `不樂故得解脫` → gate treated as unverified.

## Eligibility

Flags default off → production/demo behavior unchanged until explicitly enabled and re-measured.
