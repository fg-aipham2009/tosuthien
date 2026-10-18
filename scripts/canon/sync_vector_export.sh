#!/usr/bin/env bash
# Continuously rsync completed CBETA vector JSONL to VPS (skip in-progress .tmp).
# Usage: sync_vector_export.sh T [interval_sec]
set -u
ROOT=/Users/phamducai/tosuthien
COLL="${1:?collection e.g. T}"
INTERVAL="${2:-60}"
VPS=tosuthien-vps2
SRC="$ROOT/data/cbeta/vector_export/$COLL/"
DST="$VPS:/opt/tosu-thien/data/cbeta/vector_export/$COLL/"
LOG="$ROOT/logs/cbeta-sync-${COLL}.log"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

ssh "$VPS" "mkdir -p /opt/tosu-thien/data/cbeta/vector_export/$COLL"
log "continuous sync $COLL every ${INTERVAL}s → $DST"

while true; do
  # Only finished artifacts; ignore *.tmp mid-write
  if rsync -az --exclude='*.tmp' --exclude='*.error.txt' "$SRC" "$DST" >>"$LOG" 2>&1; then
    local_n=$(ls "$SRC"*.meta.json 2>/dev/null | wc -l | tr -d ' ')
    remote_n=$(ssh "$VPS" "ls /opt/tosu-thien/data/cbeta/vector_export/$COLL/*.meta.json 2>/dev/null | wc -l | tr -d ' '")
    log "ok local_meta=$local_n remote_meta=$remote_n"
  else
    log "rsync exit $? (will retry)"
  fi
  # Stop when embed for this coll is gone AND local==remote and stable
  if ! pgrep -f "embed_zh_export.py --collections $COLL" >/dev/null; then
    sleep "$INTERVAL"
    rsync -az --exclude='*.tmp' --exclude='*.error.txt' "$SRC" "$DST" >>"$LOG" 2>&1 || true
    local_n=$(ls "$SRC"*.meta.json 2>/dev/null | wc -l | tr -d ' ')
    remote_n=$(ssh "$VPS" "ls /opt/tosu-thien/data/cbeta/vector_export/$COLL/*.meta.json 2>/dev/null | wc -l | tr -d ' '")
    log "embed idle local=$local_n remote=$remote_n"
    if [[ "$local_n" -eq "$remote_n" && "$local_n" -gt 0 ]]; then
      log "SYNC_COMPLETE $COLL"
      exit 0
    fi
  fi
  sleep "$INTERVAL"
done
