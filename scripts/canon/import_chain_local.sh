#!/usr/bin/env bash
# Import CBETA vector_export from Mac → VPS cbeta via SSH tunnel (no JSON on VPS).
# Waits until each collection is fully embedded locally, then imports in order.
set -u
ROOT=/Users/phamducai/tosuthien
cd "$ROOT"
LOG="$ROOT/logs/cbeta-import-chain.log"
OUT="$ROOT/data/cbeta/vector_export"
XML="$ROOT/data/cbeta/xml-p5"
IMPORT_PY="$ROOT/scripts/canon/import_vector_export.py"
VPS=tosuthien-vps2
TUNNEL_LOCAL_PORT="${TUNNEL_LOCAL_PORT:-15432}"
DSN="postgresql://tosuthien:thamthien@127.0.0.1:${TUNNEL_LOCAL_PORT}/cbeta"
# After T/X/J (already in DB). B may already be importing.
ORDER=(B ZW I N G D GA Y YP F L P A C K LC CC U GB S M ZS)

log() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

ensure_tunnel() {
  if nc -z 127.0.0.1 "$TUNNEL_LOCAL_PORT" 2>/dev/null; then return 0; fi
  log "start SSH tunnel :$TUNNEL_LOCAL_PORT → VPS:5432"
  ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
    -L "${TUNNEL_LOCAL_PORT}:127.0.0.1:5432" "$VPS" || return 1
  sleep 1
  nc -z 127.0.0.1 "$TUNNEL_LOCAL_PORT"
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

db_works() {
  python3 - <<PY
import psycopg
with psycopg.connect("$DSN") as c:
    with c.cursor() as cur:
        cur.execute("SELECT count(*) FROM works WHERE collection=%s", ("$1",))
        print(cur.fetchone()[0])
PY
}

seed_collections() {
  DSN="$DSN" python3 - <<'PY'
import psycopg, os
dsn = os.environ["DSN"]
rows = [
  ("T",1),("X",2),("J",3),("B",4),("ZW",5),("I",6),("N",7),("G",8),("D",9),
  ("GA",10),("Y",11),("YP",12),("F",13),("L",14),("P",15),("C",16),("A",17),
  ("K",18),("LC",19),("CC",20),("U",21),("S",22),("GB",23),("ZS",24),("M",25),
]
with psycopg.connect(dsn) as c:
    with c.cursor() as cur:
        for code, ord_ in rows:
            cur.execute(
                """INSERT INTO collections (code, name_zh, name_vi, sort_order)
                   VALUES (%s,%s,%s,%s) ON CONFLICT (code) DO NOTHING""",
                (code, code, code, ord_),
            )
    c.commit()
PY
}

wait_embed() {
  local coll=$1
  local need
  need=$(xml_count "$coll")
  if [[ "$need" -lt 1 ]]; then
    log "skip $coll — no xml"
    return 1
  fi
  while true; do
    local done
    done=$(meta_done "$coll")
    if [[ "$done" -ge "$need" ]]; then
      log "${coll}_EMBED_READY $done/$need"
      return 0
    fi
    log "wait embed $coll $done/$need"
    sleep 60
  done
}

import_one() {
  local coll=$1
  local need done dbn
  need=$(xml_count "$coll")
  done=$(meta_done "$coll")
  dbn=$(db_works "$coll")
  if [[ "$dbn" -ge "$need" && "$need" -gt 0 ]]; then
    log "SKIP import $coll — already in DB ($dbn/$need)"
    return 0
  fi
  if [[ "$done" -lt "$need" ]]; then
    log "WARN $coll embed incomplete $done/$need — skip for now"
    return 1
  fi
  # Avoid two importers on same DB
  while pgrep -f "import_vector_export.py --collections " >/dev/null; do
    log "wait other import_vector_export to finish…"
    sleep 30
  done
  log "IMPORT $coll → VPS cbeta via tunnel ($done works)"
  DSN="$DSN" seed_collections || log "WARN seed failed"
  python3 -u "$IMPORT_PY" \
    --collections "$coll" \
    --export-dir "$OUT" \
    --dsn "$DSN" \
    >>"$LOG" 2>&1
  local rc=$?
  dbn=$(db_works "$coll")
  log "IMPORT_$coll exit=$rc db_works=$dbn/$need"
  return $rc
}

recreate_hnsw() {
  log "CREATE HNSW index…"
  python3 - <<PY
import psycopg
with psycopg.connect("$DSN") as c:
    c.execute("SET maintenance_work_mem = '1GB'")
    c.execute(
        """CREATE INDEX IF NOT EXISTS idx_cbeta_chunk_embeddings_hnsw
           ON chunk_embeddings USING hnsw (embedding vector_cosine_ops)"""
    )
    c.commit()
print("HNSW ok")
PY
  log "HNSW done"
}

log "===== import_chain_local start order=${ORDER[*]} ====="
ensure_tunnel || { log "FATAL no tunnel"; exit 1; }
export DSN

for coll in "${ORDER[@]}"; do
  wait_embed "$coll" || continue
  import_one "$coll" || log "WARN import $coll failed — continue"
done

recreate_hnsw || log "WARN HNSW recreate failed"
log "===== import_chain_local ALL DONE ====="
