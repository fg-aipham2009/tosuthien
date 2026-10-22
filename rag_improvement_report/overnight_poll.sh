#!/usr/bin/env bash
set -euo pipefail
ROOT="/Users/phamducai/tosuthien"
REP="$ROOT/rag_improvement_report"
LOG="$REP/acceptance_poll.log"
exec >"$LOG" 2>&1
echo "acceptance poll start $(date -u)"
for n in $(seq 1 60); do
  out=$(ssh -o BatchMode=yes -o ConnectTimeout=20 tosuthien-vps2 \
    'pgrep -f run_rag_qa_eval.py >/dev/null && echo EVAL_ALIVE || echo EVAL_DEAD; pgrep -f run_independent_30.py >/dev/null && echo IND_ALIVE || echo IND_DEAD; wc -l /opt/tosu-thien/rag_test_results/rag_responses.jsonl 2>/dev/null; tail -3 /opt/tosu-thien/rag_test_results/run_eval.log; tail -2 /opt/tosu-thien/rag_test_results/run_independent.log 2>/dev/null; grep -c ALL_DONE /opt/tosu-thien/rag_test_results/run_eval.log 2>/dev/null || true')
  echo "=== poll $n $(date +%H:%M:%S) ==="
  echo "$out"
  if echo "$out" | grep -q ALL_DONE; then
    break
  fi
  # finished both if eval dead and independent log has DONE
  if echo "$out" | grep -q EVAL_DEAD && echo "$out" | grep -q 'DONE'; then
    if ! echo "$out" | grep -q IND_ALIVE; then
      break
    fi
  fi
  sleep 120
done
scp -o BatchMode=yes \
  tosuthien-vps2:/opt/tosu-thien/rag_test_results/{rag_responses.jsonl,retrieval_traces.jsonl,evaluation.csv,quality_report.md,failed_cases.md,evaluation_summary.json,run_eval.log,corpus_scope.json,test_cases.jsonl,independent_responses.jsonl,independent_evaluation.csv,independent_summary.json,run_independent.log} \
  "$ROOT/rag_test_results/" || true
cp "$ROOT/rag_test_results/evaluation.csv" "$REP/regression_results.csv" || true
python3 "$REP/_finalize_acceptance.py"
echo "acceptance poll done $(date -u)"
