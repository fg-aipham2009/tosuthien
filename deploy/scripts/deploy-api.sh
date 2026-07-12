#!/usr/bin/env bash
# Sync NestJS API sources to VPS and force-recreate the api container.
# Usage (asks for VPS password):
#   ./deploy/scripts/deploy-api.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-root@168.144.120.72}"
VPS_REPO="${VPS_REPO:-/opt/tosu-thien}"

echo "==> rsync nestjs/ → $VPS_HOST:$VPS_REPO/nestjs/"
rsync -avz \
  --exclude node_modules \
  --exclude dist \
  --exclude .env \
  "$REPO_ROOT/nestjs/" "$VPS_HOST:$VPS_REPO/nestjs/"

echo "==> docker compose build --force-recreate api"
ssh -t "$VPS_HOST" "cd $VPS_REPO && docker compose up -d --build --force-recreate api"

echo ""
echo "Test:"
echo "  curl -sS -X POST https://api.tosuthien.net/api/rag/chat -H 'Content-Type: application/json' -d '{\"question\":\"thoại đầu là gì\"}'"
