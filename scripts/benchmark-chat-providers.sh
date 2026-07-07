#!/usr/bin/env bash
# Compare RAG latency/quality: shopaikey vs nexus (same question).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${API_URL:-http://localhost:8000/api}"
QUESTION="${1:-Phật tánh là gì}"

run_chat() {
  local provider="$1"
  export CHAT_PROVIDER="$provider"
  echo ""
  echo "========== CHAT_PROVIDER=$provider =========="
  docker stop tosu_api >/dev/null 2>&1 || true
  docker rm tosu_api >/dev/null 2>&1 || true
  docker run -d --name tosu_api \
    --network kinhsach_default \
    --env-file "$ROOT/.env" \
    -e CHAT_PROVIDER="$provider" \
    -e DATABASE_URL=postgresql://tosuthien:thamthien@tosu_db:5432/tosuthien \
    -e DATA_ROOT=/data \
    -e PUBLIC_BASE_URL=http://localhost:8000 \
    -e PORT=8000 \
    -e EMBEDDING_BASE_URL=http://host.docker.internal:7997/v1 \
    -p 8000:8000 \
    -v "$ROOT/data:/data" \
    tosuthien-api:latest >/dev/null

  for i in $(seq 1 30); do
    curl -sf "$API/health" >/dev/null 2>&1 && break
    sleep 1
  done

  python3 - "$API" "$QUESTION" "$provider" <<'PY'
import json, sys, urllib.request
api, question, provider = sys.argv[1:4]
body = json.dumps({"question": question}).encode()
req = urllib.request.Request(
    f"{api}/rag/chat",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=180) as res:
    data = json.load(res)
m = data.get("meta", {})
print(f"provider_meta: {m.get('chatProvider')}")
print(f"searchMode: {m.get('searchMode')}")
print(f"answerStyle: {m.get('answerStyle')}")
print(f"retrievalMs: {m.get('retrievalMs')}")
print(f"llmMs: {m.get('llmMs')}")
print(f"totalMs: {m.get('totalMs')}")
print(f"citations: {len(data.get('citations', []))}")
ans = data.get("answer", "")
print(f"answer_chars: {len(ans)}")
print("--- answer preview ---")
print(ans[:500])
if len(ans) > 500:
    print("...")
PY
}

cd "$ROOT/nestjs" && npm run build >/dev/null
cd "$ROOT" && docker compose build api >/dev/null 2>&1 || docker build -t tosuthien-api:latest "$ROOT/nestjs"

run_chat shopaikey
run_chat nexus

echo ""
echo "Done. Set CHAT_PROVIDER in .env to keep the winner, then restart API."
