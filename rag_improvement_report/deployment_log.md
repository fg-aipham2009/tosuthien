# Deployment log (DEMO)

- Target: `demo.tosuthien.net` / VPS `tosuthien-vps2` `/opt/tosu-thien`
- Model: `claude-opus-5-5`
- Keys: pool includes `sk-6465f4b5…` (primary) + prior live keys; removed dead `sk-28f62…`

## Steps performed

1. Synced Nest CBETA source → VPS.
2. `docker compose build api && docker compose up -d --force-recreate api`.
3. Health: CBETA `works=4985`, `chunks=256168`.
4. Smoke (post-fix):
   - TEST01/02 → `景德傳燈錄` · quyển 8 · `p.0256c07` · 43 見錄 + 13 不錄.
   - F02 → `X78n1553 = 天聖廣燈錄`.
5. Started full regression: `run_rag_qa_eval.py` on VPS (`CBETA_API_BASE=http://127.0.0.1:8000/api`).

## Rollback

- Compose backup created earlier as `docker-compose.yml.bak.qa-*` on VPS when model overrides were applied.
- Revert API image: redeploy previous `tosuthien-api:local` build / git checkout prior Nest files + rebuild.
