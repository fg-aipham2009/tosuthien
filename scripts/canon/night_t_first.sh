#!/usr/bin/env bash
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

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

ensure_embed_server() {
  if curl -sf http://127.0.0.1:7997/health >/dev/null; then return 0; fi
  screen -S tosu-embed -X quit 2>/dev/null || true
  # MPS (Apple GPU) with modest batch — large batches have hung on this host.
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
  log "PRIORITY wait $coll ($need xml) — no other CBETA embeds"
  while true; do
    ensure_embed_server || true
    ensure_job "$coll"
    local done
    done=$(meta_done "$coll")
    log "$coll meta_done=$done / xml=$need"
    if [[ "$done" -ge "$need" && "$need" -gt 0 ]]; then
      log "${coll}_EMBED_DONE"
      return 0
    fi
    sleep 120
  done
}

sync_coll() {
  local coll=$1
  log "SYNC $coll → VPS"
  ssh "$VPS" "mkdir -p $VPS_OUT/$coll"
  rsync -az "$OUT/$coll/" "$VPS:$VPS_OUT/$coll/" >>"$LOG" 2>&1
  local remote
  remote=$(ssh "$VPS" "ls $VPS_OUT/$coll/*.meta.json 2>/dev/null | wc -l | tr -d ' '")
  log "SYNC_OK $coll remote_meta=$remote local=$(meta_done "$coll")"
}

caffeinate -dims -w $$ &
trap 'kill $! 2>/dev/null || true' EXIT

log "===== T-first pipeline start ====="
ensure_embed_server
# Incremental sync while embedding (not wait for full collection)
screen -S cbeta-sync-t -X quit 2>/dev/null || true
screen -dmS cbeta-sync-t bash -lc "exec $ROOT/scripts/canon/sync_vector_export.sh T 60"
log "started continuous sync T"

# Stop any X job while T runs
pkill -f 'embed_zh_export.py --collections X' 2>/dev/null || true
screen -S cbeta-embed-x -X quit 2>/dev/null || true

wait_coll T
sync_coll T

log "T done — starting X"
wait_coll X
sync_coll X

# remaining canons one by one
NEXT=(A B C CC D F G GA GB I J K L LC M N P Q R S U Y YP Z ZS ZW)
for coll in "${NEXT[@]}"; do
  log "===== next $coll ====="
  if [[ ! -d "$XML/$coll" ]] || [[ "$(xml_count "$coll")" -lt 1 ]]; then
    log "checkout $coll"
    (cd "$XML" && git sparse-checkout add "$coll" >>"$ROOT/logs/cbeta-checkout-${coll}.log" 2>&1
     git pull --ff-only origin master >>"$ROOT/logs/cbeta-checkout-${coll}.log" 2>&1 || true)
  fi
  if [[ "$(xml_count "$coll")" -lt 1 ]]; then
    log "skip $coll no xml"
    continue
  fi
  # only one embed at a time
  pkill -f 'embed_zh_export.py --collections ' 2>/dev/null || true
  sleep 2
  wait_coll "$coll"
  sync_coll "$coll"
done

log "===== T-first pipeline ALL DONE ====="
