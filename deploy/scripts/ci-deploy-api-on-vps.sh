#!/usr/bin/env bash
# Run on the VPS (called by GitHub Actions) to pull a prebuilt API image and restart.
# Env:
#   API_IMAGE   required — e.g. ghcr.io/fg-aipham2009/tosuthien-api:sha
#   GHCR_USER   optional — GitHub username for docker login
#   GHCR_TOKEN  optional — token with read:packages (GITHUB_TOKEN from Actions)
set -euo pipefail

REPO="${REPO_DIR:-/opt/tosu-thien}"
cd "$REPO"

if [[ -z "${API_IMAGE:-}" ]]; then
  echo "API_IMAGE is required" >&2
  exit 1
fi

echo "==> git sync"
git fetch origin main
git reset --hard origin/main

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  echo "==> docker login ghcr.io"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-github}" --password-stdin
fi

echo "==> pull $API_IMAGE"
export API_IMAGE
export API_PULL_POLICY=always
docker compose pull api

echo "==> recreate api"
docker compose up -d --no-build --force-recreate api

echo "==> health"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://127.0.0.1:8000/api/health >/dev/null; then
    curl -sf http://127.0.0.1:8000/api/health
    echo
    docker compose ps api
    exit 0
  fi
  sleep 2
done

echo "API health check failed" >&2
docker compose logs --tail=80 api >&2 || true
exit 1
