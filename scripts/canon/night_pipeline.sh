#!/usr/bin/env bash
# Overnight: finish TOSU book + CBETA ZH embed, sync each collection when done,
# then checkout→embed→sync remaining CBETA canons one-by-one.
set -u
cd /Users/phamducai/tosuthien
ROOT=/Users/phamducai/tosuthien
LOG="$ROOT/logs/night-pipeline.log"
XML="$ROOT/data/cbeta/xml-p5"
OUT="$ROOT/data/cbeta/vector_export"
VPS=tosuthien-vps2
VPS_OUT=/opt/tosu-thien/data/cbeta/vector_export
# BGE-M3 max 8192 tokens — pack ~half in CJK chars + ~10% overlap (HF model card).
BATCH_CHARS="${CANON_EMBED_BATCH_CHARS:-1200}"
OVERLAP_CHARS="${CANON_EMBED_OVERLAP_CHARS:-120}"
HTTP_BATCH="${EMBED_BATCH:-4}"
export CANON_EMBED_BATCH_CHARS="$BATCH_CHARS"
export CANON_EMBED_OVERLAP_CHARS="$OVERLAP_CHARS"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

ensure_tunnel() {
  if ! nc -z 127.0.0.1 15432 2>/dev/null; then
    log "tunnel down — reconnect"
    ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 15432:127.0.0.1:5432 "$VPS" || true
    sleep 2
  fi
}

ensure_embed_server() {
  if curl -sf http://127.0.0.1:7997/health >/dev/null; then return 0; fi
  log "embed_server down — restart screen tosu-embed"
  screen -S tosu-embed -X quit 2>/dev/null || true
  sleep 1
  screen -dmS tosu-embed bash -lc "cd $ROOT && set -a && . /tmp/tosu_mac_embed.env && set +a && export EMBED_THREADS=4 OMP_NUM_THREADS=4 MKL_NUM_THREADS=4 && exec python3 -u scripts/embed_server.py >> logs/mac-embed-server.log 2>&1"
  for _ in $(seq 1 60); do
    curl -sf http://127.0.0.1:7997/health >/dev/null && { log "embed_server ready"; return 0; }
    sleep 2
  done
  log "ERROR embed_server failed to start"
  return 1
}

book_count() {
  ensure_tunnel
  python3 - <<'PY'
import os, psycopg
from dotenv import dotenv_values
os.environ.update({k: v for k, v in dotenv_values("/tmp/tosu_mac_embed.env").items() if v})
with psycopg.connect(os.environ["DATABASE_URL"], connect_timeout=15) as c, c.cursor() as cur:
    cur.execute("""
      SELECT COUNT(*) FILTER (WHERE e.passage_id IS NOT NULL), COUNT(*)
      FROM passages p
      JOIN rag_sources r ON r.id = p.rag_source_id
      LEFT JOIN passage_embeddings e ON e.passage_id = p.id
      WHERE r.kind = 'book'
    """)
    d, t = cur.fetchone()
    print(f"{d} {t}")
PY
}

wait_book() {
  log "wait TOSU book embed…"
  while true; do
    ensure_tunnel
    ensure_embed_server || true
    read -r done total < <(book_count)
    log "book emb $done/$total"
    if [[ "${done:-0}" -ge "${total:-1}" && "${total:-0}" -gt 0 ]]; then
      log "BOOK_DONE — already on VPS via tunnel; ensure HNSW if job exited"
      # if embed.py still running, wait for it to finish create-index
      if pgrep -f "python3 -u scripts/embed.py --kind book" >/dev/null; then
        log "embed.py still finishing…"
        while pgrep -f "python3 -u scripts/embed.py --kind book" >/dev/null; do sleep 30; done
      fi
      # safety: create index if missing
      set -a; . /tmp/tosu_mac_embed.env; set +a
      python3 -u scripts/embed.py --kind book --create-index --batch-size 8 >> logs/mac-reembed-bge-m3-resume.log 2>&1 || true
      log "BOOK_SYNC_OK"
      return 0
    fi
    # restart book job if dead and incomplete
    if ! pgrep -f "python3 -u scripts/embed.py --kind book" >/dev/null; then
      log "book job dead — resume"
      screen -S tosu-embed-job -X quit 2>/dev/null || true
      screen -dmS tosu-embed-job bash -lc "cd $ROOT && set -a && . /tmp/tosu_mac_embed.env && set +a && exec python3 -u scripts/embed.py --kind book --create-index --batch-size 8 >> logs/mac-reembed-bge-m3-resume.log 2>&1"
    fi
    sleep 120
  done
}

xml_count() {
  local coll=$1
  find "$XML/$coll" -name "*.xml" 2>/dev/null | wc -l | tr -d " "
}

meta_count() {
  local coll=$1
  ls "$OUT/$coll"/*.meta.json 2>/dev/null | wc -l | tr -d " "
}

wait_collection_embed() {
  local coll=$1
  local need
  need=$(xml_count "$coll")
  if [[ "${need:-0}" -lt 1 ]]; then
    log "SKIP $coll — no XML on disk"
    return 1
  fi
  log "wait CBETA $coll embed ($need XML)…"
  while true; do
    ensure_embed_server || true
    local done
    done=$(meta_count "$coll")
    # only count metas with status done
    done=$(python3 - <<PY
from pathlib import Path
import json
d=Path("$OUT")/"$coll"
n=0
if d.is_dir():
  for p in d.glob("*.meta.json"):
    try:
      if json.loads(p.read_text()).get("status")=="done": n+=1
    except Exception: pass
print(n)
PY
)
    log "$coll meta_done=$done / xml=$need"
    if [[ "$done" -ge "$need" ]]; then
      log "${coll}_EMBED_DONE"
      return 0
    fi
    # job alive?
    if ! pgrep -f "embed_zh_export.py --collections $coll" >/dev/null; then
      log "$coll embed job dead — restart"
      screen -S "cbeta-embed-${coll}" -X quit 2>/dev/null || true
      screen -dmS "cbeta-embed-${coll}" bash -lc "cd $ROOT && export CANON_EMBED_BATCH_CHARS=$BATCH_CHARS CANON_EMBED_OVERLAP_CHARS=$OVERLAP_CHARS EMBED_BATCH=$HTTP_BATCH && exec python3 -u scripts/canon/embed_zh_export.py --collections $coll --batch-chars $BATCH_CHARS --overlap-chars $OVERLAP_CHARS --http-batch $HTTP_BATCH >> logs/cbeta-embed-zh-${coll}.log 2>&1"
    fi
    sleep 180
  done
}

sync_collection() {
  local coll=$1
  log "SYNC $coll → $VPS:$VPS_OUT/$coll"
  ssh "$VPS" "mkdir -p $VPS_OUT/$coll"
  rsync -az --info=stats2 "$OUT/$coll/" "$VPS:$VPS_OUT/$coll/" >>"$LOG" 2>&1
  local remote
  remote=$(ssh "$VPS" "ls $VPS_OUT/$coll/*.meta.json 2>/dev/null | wc -l | tr -d ' '")
  local localc
  localc=$(meta_count "$coll")
  log "SYNC_OK $coll local_meta=$localc remote_meta=$remote"
}

checkout_collection() {
  local coll=$1
  if [[ -d "$XML/$coll" ]] && [[ "$(xml_count "$coll")" -gt 0 ]]; then
    log "$coll already on disk ($(xml_count "$coll") xml)"
    return 0
  fi
  log "sparse-checkout add $coll"
  (
    cd "$XML" || exit 1
    git sparse-checkout add "$coll" >>"$ROOT/logs/cbeta-checkout-${coll}.log" 2>&1
    git pull --ff-only origin master >>"$ROOT/logs/cbeta-checkout-${coll}.log" 2>&1 || true
  )
  log "$coll checkout xml=$(xml_count "$coll")"
}

embed_collection() {
  local coll=$1
  ensure_embed_server || return 1
  screen -S "cbeta-embed-${coll}" -X quit 2>/dev/null || true
  screen -dmS "cbeta-embed-${coll}" bash -lc "cd $ROOT && export CANON_EMBED_BATCH_CHARS=$BATCH_CHARS CANON_EMBED_OVERLAP_CHARS=$OVERLAP_CHARS EMBED_BATCH=$HTTP_BATCH && exec python3 -u scripts/canon/embed_zh_export.py --collections $coll --batch-chars $BATCH_CHARS --overlap-chars $OVERLAP_CHARS --http-batch $HTTP_BATCH >> logs/cbeta-embed-zh-${coll}.log 2>&1"
  wait_collection_embed "$coll"
}

# Remaining canons after T/X — one by one (skip TX alias / empty)
NEXT_CANONS=(A B C CC D F G GA GB I J K L LC M N P Q R S U Y YP Z ZS ZW)

log "===== night pipeline start ====="
# keep Mac awake
caffeinate -dims -w $$ &
CAFFEINE_PID=$!
trap 'kill $CAFFEINE_PID 2>/dev/null || true' EXIT

ensure_tunnel
ensure_embed_server

# 1) TOSU book
wait_book

# 2) X then sync (may already be running)
wait_collection_embed X
sync_collection X

# 3) T then sync
wait_collection_embed T
sync_collection T

# 4) next canons sequentially
for coll in "${NEXT_CANONS[@]}"; do
  log "===== next collection $coll ====="
  checkout_collection "$coll" || continue
  if [[ "$(xml_count "$coll")" -lt 1 ]]; then
    log "no XML for $coll — skip"
    continue
  fi
  embed_collection "$coll"
  sync_collection "$coll"
done

log "===== night pipeline ALL DONE ====="
