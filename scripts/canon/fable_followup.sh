#!/usr/bin/env bash
# Re-run the Fable pass whenever a work finishes (or the Fable key file changes), so rows whose Fable
# confirmation was skipped (no credit, work still in progress) are confirmed later.
# Usage: scripts/canon/fable_followup.sh <translations dir> [pid to wait for first]
set -u
DIR=$1
WAIT_PID=${2:-}
POLL=${FABLE_FOLLOWUP_POLL:-60}
LOG="$DIR/_flagged_fable.log"
export HHTECH_API_KEYS_FILE=${HHTECH_API_KEYS_FILE:-$HOME/.config/tosuthien/hhtech_keys}
export HHTECH_CONFIRM_KEYS_FILE=${HHTECH_CONFIRM_KEYS_FILE:-$HOME/.config/tosuthien/hhtech_fable_key}

finished() { ls "$DIR"/X*.json 2>/dev/null | grep -vc '\.partial\.json$'; }
key_mtime() { stat -f %m "$HHTECH_CONFIRM_KEYS_FILE"; }

if [ -n "$WAIT_PID" ]; then
  while kill -0 "$WAIT_PID" 2>/dev/null; do sleep "$POLL"; done
fi

while true; do
  seen_works=$(finished)
  seen_key=$(key_mtime)
  echo "=== $(date) Fable follow-up pass ($seen_works finished works)" >> "$LOG"
  python3 -u scripts/canon/adjudicate_file.py "$DIR" --translator claude-opus-5-5 --reviewer gpt-6-astra \
    --adjudicator gpt-6-astra --arbiter gpt-6-astra --confirmer claude-fable-5-1 \
    --recheck-uncertain --workers 2 --max-attempts 3 --retry-wait 60 \
    --summary "$DIR/_flagged_fable.md" >> "$LOG" 2>&1
  echo "=== $(date) Fable follow-up pass ended (exit $?)" >> "$LOG"
  python3 -u scripts/canon/resolve_with_parallels.py "$DIR" --canon-dir data/cbeta/xml-p5/X \
    --cache-dir "$HOME/.cache/tosuthien/cbeta_plain/X" --translator claude-opus-5-5 --reviewer gpt-6-astra \
    --confirmer claude-fable-5-1 --window 8 --context 40 --max-parallels 6 --workers 2 --max-attempts 3 \
    --retry-wait 60 --report "$DIR/_uncertain_review.md" >> "$DIR/_parallels.log" 2>&1
  python3 -u scripts/canon/retrofit_unsure_source.py "$DIR" --model gpt-6-astra --rows-per-call 20 --workers 8 \
    --max-attempts 3 --retry-wait 30 >> "$DIR/_retrofit.log" 2>&1
  while [ "$(finished)" = "$seen_works" ] && [ "$(key_mtime)" = "$seen_key" ]; do sleep "$POLL"; done
done
