# CBETA RAG — Root Cause Analysis

Scope: seven real-world eval cases (multi-work retrieval, citation locators, false quote rejection).  
Investigation date: 2026-10-22. No production DB or VPS deploy in this increment.

## Issue A — Multi-work / wrong-work retrieval

| | |
|--|--|
| **Cases** | 01 (`T08n0235`→`T08n0236a`), 06 (`T51n2076`+`T48n2005`), 07 (`T48n2007`+`T48n2008`) |
| **Reproduction** | Ask with two explicit work IDs, or one ID whose sister translation also contains the phrase. |
| **Observed** | Single SQL `work_code = ANY(...)` + score diversify; `refineScripturePhraseHits` fell through to genre/score when named-work phrase hits were empty → sister translation cited. Multi-work questions kept only the highest-scoring work’s phrase hit. |
| **Expected** | Each explicitly named work searched independently; no silent sister-translation substitute; missing work reported as diagnostic, not as “absent from CBETA”. |
| **Root cause** | (1) `retrieveScriptureGrounded` treated multiple `workCodes` as one OR-filter, not per-work quotas. (2) `refineScripturePhraseHits` used soft prefer-then-fallthrough. (3) `selectEvidenceHits` returned refine of the *first* matching phrase only. |
| **Files** | `cbeta-retrieve.service.ts`, `cbeta-evidence.util.ts`, `cbeta-query-parse.util.ts` (parse OK) |
| **Severity** | High — wrong primary text / missing requested witness. |

## Issue B — Citation locators point at chunk start, not quote span

| | |
|--|--|
| **Cases** | 02 (`T30n1564`), 03 (`T09n0262`), 05 (wrong juan cue), 07 |
| **Reproduction** | Quote a mid-chunk verse; UI shows `cbetaRefStart` of the retrieved chunk. |
| **Observed** | `toCitations` copied `h.cbetaRefStart` and full `contentZh`; no quote-span mapping. |
| **Expected** | Preserve chunk locator; when quote is found in chunk, attach quote/passage metadata without inventing mid-chunk lineheads. |
| **Root cause** | Pipeline has chunk-level TEI refs only — no character→linehead map. Code treated chunk start as quote locator. |
| **Files** | `cbeta-chat.service.ts` (`toCitations`), types in `cbeta.types.ts` |
| **Severity** | Medium — links usually open the right work/area but mislead on exact verse. |

## Issue C — False rejection of valid quotes

| | |
|--|--|
| **Cases** | 05–06 (e.g. `道得即救取猫兒`, `師便斬之`, `道不屬知不知`); also Agama missing `得` in model output |
| **Reproduction** | STRICT_VERIFY on; answer fences a quote that exists in CBETA but not in *packed* evidence, or differs by one omitted character. |
| **Observed** | Gate replaced quote with `〔trích dẫn chưa xác minh — đã ẩn〕`. |
| **Expected** | Keep quote when evidence (or bounded re-lookup) verifies it; restore exact evidence orthography; still strip fabrications. |
| **Root cause** | (1) Evidence pack / multi-work miss → verify against incomplete hits. (2) Model omitted characters (`得`) → exact/punct match failed; no indel align-to-evidence step. (3) Gate correctly strict — failure was upstream, not “gate too mean” alone. |
| **Files** | `cbeta-doctrinal-gate.util.ts`, `cbeta-claim-verify.util.ts`, pack path in `cbeta-chat.service.ts` |
| **Severity** | High for user trust when source text was actually retrieved. |

## Baseline note

Pre-change unit suite was green. End-to-end latency/recall numbers are *not* fabricated here — see `CBETA_RAG_BENCHMARK.md` for what was measured locally (unit helpers + flag-off compatibility).
