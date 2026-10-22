# CBETA Scripture Meaning Verification & Reliability Gate

**Date:** 2026-10-22  
**Target:** demo / VPS `tosuthien-vps2` (`/opt/tosu-thien`)  
**Flag:** `CBETA_STRICT_VERIFY=1` (on demo for measurement; default documented as off in `.env.example`)

**Acceptance rule:** No verified evidence → no unsupported canonical claim.

---

## 1. Files modified

| File | Role |
|------|------|
| `nestjs/src/rag/cbeta/cbeta-claim-verify.util.ts` | Exact / NFC / punct / OpenCC-needle / locator claim records |
| `nestjs/src/rag/cbeta/cbeta-claim-verify.util.test.ts` | Unit coverage |
| `nestjs/src/rag/cbeta/cbeta-context-verify.util.ts` | Contextual pack + interpretive claim support statuses |
| `nestjs/src/rag/cbeta/cbeta-doctrinal-gate.util.ts` | Deterministic attribution gate + strip/qualify |
| `nestjs/src/rag/cbeta/cbeta-doctrinal-gate.util.test.ts` | Gate unit tests |
| `nestjs/src/rag/cbeta/cbeta-chat.service.ts` | Wire gate + contextual meta; scripture pack = evidence + same-work neighbors |
| `nestjs/src/rag/cbeta/cbeta-evidence.util.ts` | Phrase-only cites; genre/score refine (no invented max-N) |
| `nestjs/src/rag/cbeta/cbeta-genre.util.ts` | Commentary markers before 經 (fix 「心經疏」≠經) |
| `nestjs/src/rag/cbeta/cbeta-scripture-intent.util.test.ts` | Evidence fidelity + genre preference |
| `.env.example` | `CBETA_STRICT_VERIFY` docs |
| `rag_test_results/golden_scripture_explanation_60.jsonl` | 60-case seed |
| `rag_test_results/phrase_verified.json` | DB phrase locator hits |
| `rag_test_results/golden_60_review_status.json` | Review counts |
| `rag_test_results/_verify_phrase_locators.py` | Corpus locator helper |

---

## 2. Root causes addressed

1. **Verbatim quotes presented without deterministic match** → claim-verify + gate strip/qualify when `CBETA_STRICT_VERIFY=1`.
2. **Exact quote ≠ doctrinal correctness** → contextual claim typing (`literal` / `contextual` / `commentarial` / `cross_text` / `unsupported_speculation`) with support statuses.
3. **Commentary / Buddha-speech confusion** → genre-aware risk scan + 疏-before-經 title fix.
4. **Citation flood on common phrases** (e.g. 色即是空 across 60+ works) → phrase match + prefer named works / primary genre tier / top score ties only; pack no longer appends unrelated hybrid rest for scripture modes.
5. **LLM-only doctrinal judge** → gate is heuristic/deterministic; uncertainty recorded in `meta.claimVerification` / `meta.doctrinalGate`.

---

## 3. Verifier implementation details

### Quote validation (`cbeta-claim-verify.util.ts`)

- `evidenceContainsPhrase`: exact → punct-normalized (NFC, strip CJK punct/space) → OpenCC **needle only** (`cn→tw`); evidence text never rewritten.
- `verifyQuestionPhrasesAgainstEvidence` / `verifyAnswerQuotesAgainstEvidence` → `support_status` + `match_kind` + `verified_as_verbatim`.
- Unverified fenced CJK quotes → `unsupported` (not labeled verbatim).
- Locator: `verifyLocatorAgainstHits` via `cbetaRefCovers` / bare ref.

### Contextual verification (`cbeta-context-verify.util.ts`)

- Primary phrase hit + same-work neighbors (`|ΔchunkIndex|≤2`).
- Speaker/section heuristics from Hán text.
- Interpretive sentences linked with statuses: `supported` | `partially_supported` | `unsupported` | `insufficient_evidence` (+ types for contradicted / interpretive_disagreement reserved in union).

### Doctrinal gate (`cbeta-doctrinal-gate.util.ts`)

- Enabled only when `CBETA_STRICT_VERIFY` / `CBETA_DOCTRINAL_GATE` ∈ {1,true,on,yes}.
- Risks: emptiness≈nonexistence, anatta annihilation, 無住→inaction, universalize one school, commentary-as-Buddha, unverified verbatim.
- `applyDoctrinalGateToAnswer`: strip unverified quotes; append qualification note.

---

## 4. Source attribution behavior

- Genre labels prefer 疏/鈔/註 when title contains those markers (even if also contains 心經/金剛…).
- Scripture UI citations prefer 經/律/論 over commentary reprints of the same phrase.
- Gate qualifies / blocks answers that attribute commentary as direct Buddha speech without 經 evidence.
- Citations keep original `contentZh` / locator orthography (no silent historical rewrite).

---

## 5. Golden test dataset and review status

File: `rag_test_results/golden_scripture_explanation_60.jsonl`

| review_status | count | meaning |
|---------------|------:|---------|
| `verified_prior` | 1 | Yunyan 法嗣 (prior human/regression) |
| `corpus_located` | 13 | Phrase+work found in CBETA DB with locator + passage excerpt |
| `pending_human` | 46 | Seeded questions; **not** independently doctrinally verified |

**Honest total independently verified doctrinal gold: 1.**  
Corpus location ≠ accepted interpretation review. LLM answers are never marked verified.

Genres covered in seeds: Prajñā, Āgama, Lotus, Avataṃsaka, Pure Land, Vinaya, Abhidharma, Madhyamaka, Yogācāra, commentaries, Nirvana, Vimalakīrti, etc.

---

## 6. Test commands actually executed

```bash
# Local
cd nestjs && npm run test:cbeta
# → 126/126 pass (after genre + evidence refine)

npx tsx --test src/rag/cbeta/cbeta-claim-verify.util.test.ts \
  src/rag/cbeta/cbeta-doctrinal-gate.util.test.ts
# → 5/5 pass

# VPS corpus locators
python3 /tmp/_verify_phrase_locators.py

# Live API (CBETA_API_BASE=http://127.0.0.1:8000/api)
python3 rag_test_results/run_yunyan_relation_regression.py
python3 rag_test_results/run_doctrinal_safety_smoke.py
# Custom cite/gate smoke → cite_gate_smoke.json / cite_gate_after.json
```

### Completed vs blocked

| Suite | Status |
|-------|--------|
| Unit `test:cbeta` | **Completed** 126/126 |
| Claim/gate unit | **Completed** 5/5 |
| Yunyan regression | **Completed** 6/7 (C3_translate fail: gloss dumps 法嗣 names incl. 洞山良价) |
| Doctrinal smoke | **Re-run after redeploy** (see after metrics) |
| Cite/gate live smoke | **Completed** before + after cite-ranking fix |
| Full 60 gold human review | **Blocked** — pending_human; no independent doctrinal oracle |
| Public demo Cloudflare path | Not separately required; VPS localhost `/api/cbeta/*` used |

---

## 7. Before/after measurements

### Citation noise (scripture explain)

| Case | Before (STRICT on, pre-refine) | After v3/v4 (genre + body title + affinity) |
|------|-------------------------------:|---------------------------------------------|
| Heart 色即是空… | **67** works (commentaries/X26 flood) | **1** cite — `T08n0250` 摩訶般若波羅蜜大明呪經 (Heart-family 經) |
| Diamond 應無所住… | **32** works | **1** cite — `T08n0236a` 金剛般若波羅蜜經 (Diamond-family 經, not T08n0235) |
| Lotus 唯有一佛乘 | 14 works + unverified quote qualify | Intermediate: Platform 壇經 (honest abstention in answer). After 壇經→語錄 demotion: see `lotus_v5.json` |
| Madhyamaka 眾因緣生法 | 5 works | Includes `T30n1564` 中論; residual 疏/modern LC titles when multi-hit |

Artifacts: `cite_gate_smoke.json` (before), `cite_gate_v3.json` / `cite_gate_v4.json` (after).

Before Heart sample cited 維摩經抄 / 寶藏論 / dozens of X26 commentaries — **prior phrase-dedupe alone was insufficient** until genre/body-title/affinity refine.

### Gate behavior (before refine deploy)

- `doctrinalGate.enabled=true` on all four smokes.
- Lotus: findings=`unverified_verbatim_quote`, `has_qualify_note=true`.
- Heart/Diamond: reject emptiness/inaction readings in answer prose (smoke answers); claimVerification mix of supported/partial/unsupported.

### Category scoring (honest)

| Metric | Notes |
|--------|-------|
| Exact quote validity | Deterministic match_kind; OpenCC needle-only |
| Locator accuracy | Yunyan C2 pass; gold locators for 13 corpus_located |
| Citation support | Improved post-refine; before = fail on ubiquitous phrases |
| Claim faithfulness | Meta only; not full 60 eval |
| Doctrinal attribution | Heuristic gate; not full-corpus accuracy |
| Unsupported assertion rate | Not claimed as % of all Buddhist Qs |
| Appropriate abstention | Qualify note when STRICT + findings |

**Do not treat smoke pass rate as total system accuracy.**

---

## 8. Regression results

- **Unit:** 126/126 pass.
- **Yunyan:** 6/7 — failure C3_translate (expects short gloss without listing 洞山良价; personRelation deterministic formatter still lists four successors). Unrelated to STRICT_VERIFY; tracked as residual.
- **Doctrinal safety smoke:** 4/4 pass (HEART/DIAMOND/QUOTE/YUNYAN) after STRICT deploy; QUOTE cite work still imperfect on intermediate build (X26) — later builds prefer T-collection 經 bodies.
- **Live scripture smokes (v4):** Heart/Diamond → single Taishō 經-family cite; MM → includes T30n1564 + gate qualify on unverified quotes; Lotus → see `lotus_v5.json` (壇經 demoted to 語錄).

---

## 9. Unresolved risks

1. C3 gloss still routed/answered as full 法嗣 block.
2. Contextual support still uses CJK bigram overlap — not full hermeneutic proof.
3. OpenCC covers simplified→traditional needles; rare historical variants outside OpenCC remain `insufficient_evidence`.
4. **1 verified_prior + 13 corpus_located + 46 pending_human** — not 60 independently verified doctrinal gold.
5. STRICT_VERIFY adds qualify/strip path latency; LLM cost unchanged when evidence already retrieved.
6. Score-tie cite selection can still emit multiple primary 經 if scores equal (MM still multi-cite).
7. **Lotus phrase retrieve** can still miss `T09n0262` in the packed evidence set; system now **abstains** rather than inventing Lotus commentary from 壇經/T85 — correct per NO EVIDENCE → NO CLAIM, but primary-work recall remains a retrieval gap.
8. Alternate translations (T08n0250 vs T08n0251; T08n0236a vs T08n0235) may win over the “usual” Taishō ID when shorter chunks score higher — still 經-family, not commentary flood.

---

## 10. Deployment and rollback

**Deployed:** rsync `nestjs/src/rag/cbeta/*` + `docker compose build api && up -d --force-recreate api` on `tosuthien-vps2`.  
**Flag:** `CBETA_STRICT_VERIFY=1` in VPS `.env` (demo measurement).

**Rollback:**

```bash
# Disable gate without code rollback
sed -i 's/^CBETA_STRICT_VERIFY=.*/CBETA_STRICT_VERIFY=0/' /opt/tosu-thien/.env
docker compose up -d --force-recreate api

# Or revert image / git checkout prior api image tag and recreate
```

API contract preserved: same `/api/cbeta/chat` fields; additive `meta.claimVerification`, `meta.doctrinalGate`.

---

## Before/after example (Heart)

**Q:** 色即是空，空即是色 có nghĩa là mọi thứ đều không tồn tại phải không?

**Before cites:** 67 works (commentaries + reprints).  
**Gate:** enabled; answer rejected nonexistence reading.  
**Corpus anchor:** T08n0251 · `0848a03` · `…色即是空，空即是色；受、想、行、識，亦復如是…`

**After (v4):** 1 cite `T08n0250` 摩訶般若波羅蜜大明呪經; answer rejects nonexistence; `gate_enabled=true`.  
Full write-up artifacts under `rag_improvement_report/cite_gate_*.json`, `lotus_v5.json`, `yunyan_after.log`, `doctrinal_after.log`.
