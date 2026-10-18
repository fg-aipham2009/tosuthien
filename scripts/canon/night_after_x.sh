#!/usr/bin/env bash
# Overnight: finish X → import cbeta DB → remaining canons many→few (embed → sync → import).
# Safe to start while X embed is already running (will not kill it).
set -u
ROOT=/Users/phamducai/tosuthien
cd "$ROOT"
LOG="$ROOT/logs/night-pipeline.log"
OUT="$ROOT/data/cbeta/vector_export"
XML="$ROOT/data/cbeta/xml-p5"
VPS=tosuthien-vps2
VPS_OUT=/opt/tosu-thien/data/cbeta/vector_export
BATCH_CHARS=1200
OVERLAP_CHARS=120
HTTP_BATCH=8
IMPORT_PY="$ROOT/scripts/canon/import_vector_export.py"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

ensure_embed_server() {
  if curl -sf http://127.0.0.1:7997/health >/dev/null; then return 0; fi
  screen -S tosu-embed -X quit 2>/dev/null || true
  screen -dmS tosu-embed bash -lc "cd $ROOT && set -a && . /tmp/tosu_mac_embed.env && set +a && export EMBED_DEVICE=mps EMBED_BATCH=8 EMBED_THREADS=4 PYTORCH_ENABLE_MPS_FALLBACK=1 && exec python3 -u scripts/embed_server.py >> logs/mac-embed-server.log 2>&1"
  for _ in $(seq 1 60); do curl -sf http://127.0.0.1:7997/health >/dev/null && return 0; sleep 2; done
  return 1
}

xml_count() { find "$XML/$1" -name "*.xml" 2>/dev/null | wc -l | tr -d " "; }

meta_done() {
  python3 - <<PY
from pathlib import Path
import json
d=Path("$OUT")/"$1"
n=0
if d.is_dir():
  for p in d.glob("*.meta.json"):
    try:
      if json.loads(p.read_text()).get("status")=="done": n+=1
    except Exception: pass
print(n)
PY
}

ensure_job() {
  local coll=$1
  if pgrep -f "embed_zh_export.py --collections $coll" >/dev/null; then return 0; fi
  log "start embed $coll"
  screen -S "cbeta-embed-${coll}" -X quit 2>/dev/null || true
  screen -dmS "cbeta-embed-${coll}" bash -lc "cd $ROOT && export CANON_EMBED_BATCH_CHARS=$BATCH_CHARS CANON_EMBED_OVERLAP_CHARS=$OVERLAP_CHARS EMBED_BATCH=$HTTP_BATCH && exec python3 -u scripts/canon/embed_zh_export.py --collections $coll --batch-chars $BATCH_CHARS --overlap-chars $OVERLAP_CHARS --http-batch $HTTP_BATCH >> logs/cbeta-embed-zh-${coll}.log 2>&1"
}

wait_coll() {
  local coll=$1
  local need
  need=$(xml_count "$coll")
  if [[ "$need" -lt 1 ]]; then
    log "skip wait $coll — no xml"
    return 1
  fi
  log "PRIORITY wait $coll ($need xml)"
  # Embed stays on Mac only — sync once at import_coll, then delete VPS copy.
  while true; do
    ensure_embed_server || true
    ensure_job "$coll"
    local done
    done=$(meta_done "$coll")
    log "$coll meta_done=$done / xml=$need"
    if [[ "$done" -ge "$need" ]]; then
      log "${coll}_EMBED_DONE"
      return 0
    fi
    sleep 120
  done
}

sync_coll() {
  local coll=$1
  # One-shot push for import (do not leave continuous sync running)
  screen -S "cbeta-sync-${coll}" -X quit 2>/dev/null || true
  pkill -f "sync_vector_export.sh $coll" 2>/dev/null || true
  log "SYNC once $coll → VPS (temp for import)"
  ssh "$VPS" "mkdir -p $VPS_OUT/$coll"
  rsync -az --exclude='*.tmp' --exclude='*.error.txt' "$OUT/$coll/" "$VPS:$VPS_OUT/$coll/" >>"$LOG" 2>&1
  local remote
  remote=$(ssh "$VPS" "ls $VPS_OUT/$coll/*.meta.json 2>/dev/null | wc -l | tr -d ' '")
  log "SYNC_OK $coll remote_meta=$remote local=$(meta_done "$coll")"
}

seed_collections() {
  # Ensure FK targets exist (codes only; names filled by schema if missing)
  ssh "$VPS" "cd /opt/tosu-thien && docker compose exec -T db psql -U tosuthien -d cbeta -v ON_ERROR_STOP=1 -c \"
INSERT INTO collections (code, name_zh, name_vi, sort_order)
SELECT v.code, v.code, v.code, v.ord
FROM (VALUES
  ('T',1),('X',2),('J',3),('B',4),('ZW',5),('I',6),('N',7),('G',8),('D',9),
  ('GA',10),('Y',11),('YP',12),('F',13),('L',14),('P',15),('C',16),('A',17),
  ('K',18),('LC',19),('CC',20),('U',21),('S',22),('GB',23),('ZS',24),('M',25)
) AS v(code, ord)
ON CONFLICT (code) DO NOTHING;
\"" >/dev/null
}

import_coll() {
  local coll=$1
  log "IMPORT $coll → VPS database cbeta"
  seed_collections || log "WARN seed collections failed"
  scp -q "$IMPORT_PY" "$VPS:/opt/tosu-thien/scripts/canon/import_vector_export.py"
  ssh "$VPS" "mkdir -p /opt/tosu-thien/scripts/canon /opt/tosu-thien/logs"
  # No --drop-hnsw: rebuilding HNSW on a full disk OOMs / DiskFull; keep index or create once later.
  ssh "$VPS" "docker rm -f cbeta-import-$coll 2>/dev/null; \
    docker run --rm --name cbeta-import-$coll \
      --network tosuthien_default \
      -v /opt/tosu-thien/data/cbeta/vector_export:/data:ro \
      -v /opt/tosu-thien/scripts/canon/import_vector_export.py:/import.py:ro \
      python:3.12-slim \
      bash -lc 'pip install -q \"psycopg[binary]\" && python -u /import.py --collections $coll --export-dir /data --dsn postgresql://tosuthien:thamthien@tosu_db:5432/cbeta' \
      >> /opt/tosu-thien/logs/cbeta-import-$coll.log 2>&1"
  local rc=$?
  log "IMPORT_$coll exit=$rc"
  ssh "$VPS" "tail -n 8 /opt/tosu-thien/logs/cbeta-import-$coll.log" >>"$LOG" 2>&1 || true
  if [[ $rc -eq 0 ]]; then
    # Free VPS disk: rows are in DB; Mac still has local export
    ssh "$VPS" "rm -rf $VPS_OUT/$coll" && log "CLEANUP_VPS_EXPORT $coll" || true
  fi
  return $rc
}

# Remaining canons sorted by local xml count (many → few). Skip missing Q/R/Z.
next_colls() {
  python3 - <<'PY'
from pathlib import Path
root = Path("/Users/phamducai/tosuthien/data/cbeta/xml-p5")
skip = {"T", "X", "TX", "schema"}
rows = []
for p in root.iterdir():
    if not p.is_dir() or p.name.startswith(".") or p.name in skip:
        continue
    n = len(list(p.rglob("*.xml")))
    if n > 0:
        rows.append((n, p.name))
rows.sort(key=lambda x: (-x[0], x[1]))
print(" ".join(c for _, c in rows))
PY
}

caffeinate -dims -w $$ &
trap 'kill $! 2>/dev/null || true' EXIT

# Already imported / skip re-work. EMBED_ONLY=1 → embed local only (import later).
SKIP_IMPORT="${SKIP_IMPORT:-T X J}"
EMBED_ONLY="${EMBED_ONLY:-0}"

already_imported() {
  local coll=$1
  for s in $SKIP_IMPORT; do
    [[ "$s" == "$coll" ]] && return 0
  done
  return 1
}

log "===== night_after_x start (many→few after X) EMBED_ONLY=$EMBED_ONLY SKIP_IMPORT=$SKIP_IMPORT ====="
ensure_embed_server

if already_imported X; then
  log "SKIP X wait/sync/import"
else
  wait_coll X
  if [[ "$EMBED_ONLY" != "1" ]]; then
    sync_coll X
    import_coll X || log "WARN import X failed — continue"
  fi
fi

NEXT=($(next_colls))
log "NEXT order (many→few): ${NEXT[*]}"

for coll in "${NEXT[@]}"; do
  log "===== next $coll ($(xml_count "$coll") xml) ====="
  if [[ "$(xml_count "$coll")" -lt 1 ]]; then
    log "skip $coll no xml"
    continue
  fi
  if already_imported "$coll"; then
    log "SKIP $coll"
    continue
  fi
  # one embed at a time; keep target if already running
  if pgrep -f "embed_zh_export.py --collections $coll" >/dev/null; then
    log "embed $coll already running — keep it"
  else
    pkill -f 'embed_zh_export.py --collections ' 2>/dev/null || true
    sleep 2
  fi
  wait_coll "$coll"
  if [[ "$EMBED_ONLY" == "1" ]]; then
    log "EMBED_ONLY — skip sync/import $coll"
    continue
  fi
  sync_coll "$coll"
  import_coll "$coll" || log "WARN import $coll failed — continue"
done

log "===== night_after_x ALL DONE ====="
