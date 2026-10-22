# CBETA Scripture Grounding — Working Increment Report

**Date:** 2026-10-22  
**Target:** https://demo.tosuthien.net  
**Scope:** Highest-risk defects toward scripture-grounded RAG (not full Part 1–15 rewrite).

---

## 1. Architecture audit (factual)

```
POST /api/cbeta/chat|/chat/stream|/route
  → CbetaChatService
  → rewriteCbetaSearchQuery + enrichCbetaSearchZh
  → routeCbetaQuery (+ applyCitationHints)
  → retrieve:
       sectionList | schoolLineage | personRelation
       | scriptureGrounded (quoteVerify / scriptureExplain / locator)
       | coverage deep | fast
  → pack (evidence-first) → deterministic format OR answerCbeta
```

### Route modes (after this increment)

| Mode | Trigger |
|------|---------|
| `sectionListMode` | Mazu-56 / 見錄 registers |
| `schoolLineageMode` | 五家 succession |
| `personRelationMode` | 法嗣 of one person |
| `quoteVerifyMode` | “có thật trong kinh…?” |
| `scriptureExplainMode` | giải thích / nghĩa là gì / doctrinal probe |
| `coverageMode` | document-wide patriarch enumeration |
| default `fast` | other |

---

## 2. Baseline (before this increment)

- Unit: personRelation / router / locator parse — PASS (prior).
- Yunyan regression: **6/7** (C3 gloss cite noise).
- Scripture Qs all routed `default→fast` with no grounding brief / phrase-first retrieve.
- Any `cbetaRefNeedle` forced `retrievePersonRelation` (法嗣 boost) — defect.

---

## 3. Root causes addressed

1. No scripture/quote intents → synthesis LLM without phrase priority.  
2. Locator path coupled to personRelation retrieve.  
3. Citation fallback to short CJK needles → unrelated works.  
4. No genre attribution / claim verification structure.  
5. System prompt allowed speculative fill when blocks weak.

---

## 4. Implemented changes (files)

| File | Change |
|------|--------|
| `cbeta-scripture-intent.util.ts` | quote / explain / translate / terminology detectors + grounding brief |
| `cbeta-genre.util.ts` | title-based 經/論/疏/語錄/燈錄… labels |
| `cbeta-claim-verify.util.ts` | deterministic phrase/quote ↔ evidence records |
| `cbeta-router.ts` / `cbeta.types.ts` | `quoteVerifyMode`, `scriptureExplainMode` |
| `cbeta-retrieve.service.ts` | `retrieveScriptureGrounded` + exact phrase SQL; locator ≠ personRelation |
| `cbeta-evidence.util.ts` | scripture citations = longest-phrase hits only |
| `cbeta-chat.service.ts` | grounding brief, genre on labels, claimVerification meta, excerpt quotes |
| `cbeta-diag.util.ts` | intent labels for new modes |
| `llm.service.ts` | CBETA_SYSTEM: no fabricate; SCRIPTURE_GROUNDING layers |
| `golden_cbeta_seed.jsonl` | 10 seed cases toward 300-case benchmark |
| `run_doctrinal_safety_smoke.py` | Heart / Diamond / quote / Yunyan smoke |

---

## 5. New behavior

- **Explain / quote-verify:** phrase-first retrieve → evidence-only citations → 原文/文義/註疏 brief.  
- **Locator-only:** scriptureGrounded (range cover), not 法嗣 ranking.  
- **Citations:** genre tag on label; short excerpt kept for scripture/quote modes.  
- **Meta:** `claimVerification[]` with support_status for question phrases.  
- **Diag:** `CBETA_DIAG=1` still gates full traces.

---

## 6. Tests

```bash
cd nestjs && npx tsx --test src/rag/cbeta/cbeta-scripture-intent.util.test.ts \
  src/rag/cbeta/cbeta-person-relation.util.test.ts src/rag/cbeta/cbeta-router.test.ts

CBETA_API_BASE=http://127.0.0.1:8000/api python3 rag_test_results/run_doctrinal_safety_smoke.py
CBETA_API_BASE=http://127.0.0.1:8000/api python3 rag_test_results/run_yunyan_relation_regression.py
```

### Results (executed on demo VPS 2026-10-22)

```text
run_doctrinal_safety_smoke.py → SUMMARY 4/4 PASS
  HEART   scriptureExplainMode=true  (answer rejects naive nonexistence)
  DIAMOND scriptureExplainMode=true  (rejects “do nothing” reading)
  QUOTE   quoteVerifyMode=true       (confirms phrase in CBETA)
  YUNYAN  personRelationMode=true    4 successors, 2 cites T51n2076
Unit: cbeta-scripture-intent.util.test.ts + router/personRelation → PASS
```

Residual: Heart/Diamond/Quote still returned broad multi-work cite lists on first smoke; follow-up patch adds punctuation-normalized phrase match + per-work citation dedupe + no neighbor-expand on scripture retrieve.

---

## 7. Explicitly NOT done (remaining)

- Full 300-case independently verified golden set  
- Production claim-level blocking of unsupported LLM quotes  
- Cross-commentary comparative engine  
- Reindex / structural parent–child chunk graph  
- Measured Recall@k / faithfulness dashboards  
- Staged canary + rollback automation beyond current compose recreate  

---

## 8. Risks

- Genre from title heuristics can mis-label edge works.  
- Phrase-first may miss variant orthography until OpenCC variants are added to needles.  
- Heart/Diamond answers still LLM-synthesized — grounding brief ≠ guaranteed doctrinal correctness.  
- `toUiCitations` excerpt still truncated (localStorage safety).

---

## 9. Recommended next

1. Independently verify 60 scripture-explanation gold cases.  
2. Add OpenCC variant needles for quote verify.  
3. Block or rewrite answers with `unsupported_answer_quotes` when quoteVerifyMode.  
4. Wire CBETA_DIAG sampling in production metrics.
