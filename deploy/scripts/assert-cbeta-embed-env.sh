#!/usr/bin/env bash
# Fail deploy if embedding is MiniLM/384 (breaks CBETA hybrid vs 1024-d DB).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

bad=0

check_pair() {
  local src="$1" model="$2" dim="$3"
  if echo "$model" | grep -qiE 'minilm|paraphrase-multilingual'; then
    echo "ERROR [$src]: EMBEDDING_MODEL=$model (MiniLM forbidden for CBETA)" >&2
    bad=1
  fi
  if [[ -n "$dim" && "$dim" != "1024" ]]; then
    echo "ERROR [$src]: EMBEDDING_DIM=$dim (must be 1024 for CBETA)" >&2
    bad=1
  fi
}

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  # Only pull embedding keys (avoid sourcing secrets into logs)
  model=$(grep -E '^EMBEDDING_MODEL=' .env | tail -n1 | cut -d= -f2- || true)
  dim=$(grep -E '^EMBEDDING_DIM=' .env | tail -n1 | cut -d= -f2- || true)
  set +a
  check_pair ".env" "$model" "$dim"
fi

# Compose must hard-pin (not ${EMBEDDING_MODEL} from .env)
if grep -qE 'EMBEDDING_MODEL:\s*\$\{' docker-compose.yml 2>/dev/null; then
  echo "ERROR: docker-compose.yml still interpolates EMBEDDING_MODEL from .env" >&2
  bad=1
fi
if ! grep -qE 'EMBEDDING_MODEL:\s*BAAI/bge-m3' docker-compose.yml 2>/dev/null; then
  echo "ERROR: docker-compose.yml must hard-pin EMBEDDING_MODEL: BAAI/bge-m3" >&2
  bad=1
fi
if ! grep -qE 'EMBEDDING_DIM:\s*"?1024"?' docker-compose.yml 2>/dev/null; then
  echo "ERROR: docker-compose.yml must hard-pin EMBEDDING_DIM: 1024" >&2
  bad=1
fi

if [[ "$bad" -ne 0 ]]; then
  echo "Fix: set .env EMBEDDING_MODEL=BAAI/bge-m3 EMBEDDING_DIM=1024 and keep compose pins." >&2
  exit 1
fi

echo "OK: CBETA embedding guard (BGE-M3 / 1024)"
