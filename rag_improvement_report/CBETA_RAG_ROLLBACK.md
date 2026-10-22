# CBETA RAG — Rollback

No deploy was performed in this increment. Rollback is configuration- and/or code-level.

## Instant (config only)

Unset or set to `0` / `false`:

```bash
CBETA_MULTI_WORK_RETRIEVAL=0
CBETA_QUOTE_LEVEL_CITATIONS=0
CBETA_QUOTE_VERIFY_V2=0
```

Restart API. Behavior returns to pre-increment paths (single retrieve OR-filter; citations without locator extras; gate without align/re-lookup).

`CBETA_STRICT_VERIFY` is independent — leave as currently set on demo.

## Soft code rollback (if hard constraint regresses)

Hard work-ID filter in `refineScripturePhraseHits` / `selectMultiWorkPhraseHits` is **always on** (not behind a flag) because silent sister-translation substitute is a correctness bug.

If a legitimate soft-hint path breaks:

1. Revert only the “return constrained even when empty” branch in `cbeta-evidence.util.ts`.
2. Keep multi-work retrieve behind its flag.

## Full code rollback

```bash
git revert <commit-sha>   # or reset branch before merge
# rebuild / restart nestjs as usual
```

Do **not** force-push shared branches unless explicitly requested.

## What was never changed

- Production CBETA Postgres content / indexes
- VPS `/opt/tosu-thien` (no auto-deploy)
- Public API required fields
