#!/usr/bin/env python3
"""
Import CBETA vector_export JSONL → Postgres database `cbeta` (isolated from tosuthien).

Does not re-embed. Expects rows with content_zh + embedding (dim 1024).

Usage:
  CBETA_DATABASE_URL=postgresql://tosuthien:thamthien@127.0.0.1:5432/cbeta \\
    python3 scripts/canon/import_vector_export.py --collections T

  # On VPS (files already synced):
    python3 scripts/canon/import_vector_export.py --collections T \\
      --export-dir /opt/tosu-thien/data/cbeta/vector_export
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Jsonb
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Need psycopg: pip install 'psycopg[binary]'") from exc


def vec_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{x:.8g}" for x in vec) + "]"


def load_meta(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def import_work(conn: psycopg.Connection, jsonl: Path, meta: dict) -> str:
    work_code = meta["work_code"]
    collection = meta.get("collection") or jsonl.parent.name
    expected = int(meta.get("chunk_count") or 0)
    title = meta.get("title_zh") or work_code
    model = meta.get("model") or "BAAI/bge-m3"
    dim = int(meta.get("dim") or 1024)
    batch_chars = meta.get("batch_chars")
    overlap_chars = meta.get("overlap_chars")
    source_xml = meta.get("source_xml")
    # Preserve provenance (e.g. Zen Soul / bfnn master corpora)
    extra_meta = {"import_from": str(jsonl.name)}
    if isinstance(meta.get("source"), dict):
        extra_meta["source"] = meta["source"]
    for k in ("source_label", "publisher", "editor", "master", "canon_note", "url"):
        if meta.get(k):
            extra_meta[k] = meta[k]

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT chunk_count, status FROM works WHERE work_code = %s",
            (work_code,),
        )
        row = cur.fetchone()
        if (
            row
            and row["status"] == "embedded"
            and int(row["chunk_count"]) == expected
            and expected > 0
        ):
            cur.execute(
                "SELECT count(*)::int AS n FROM chunks WHERE work_code = %s",
                (work_code,),
            )
            n = cur.fetchone()["n"]
            if n == expected:
                return "skip"

        # Replace work (CASCADE chunks + embeddings)
        cur.execute("DELETE FROM works WHERE work_code = %s", (work_code,))
        cur.execute(
            """
            INSERT INTO works (
              work_code, collection, title_zh, source_xml, chunk_count,
              batch_chars, overlap_chars, model, dim, status, metadata, embedded_at, updated_at
            ) VALUES (
              %s, %s, %s, %s, %s,
              %s, %s, %s, %s, 'pending', %s::jsonb, NULL, now()
            )
            """,
            (
                work_code,
                collection,
                title,
                source_xml,
                expected,
                batch_chars,
                overlap_chars,
                model,
                dim,
                Jsonb(extra_meta),
            ),
        )

        chunk_rows: list[tuple] = []
        emb_rows: list[tuple] = []
        n = 0
        with jsonl.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                o = json.loads(line)
                emb = o.get("embedding")
                if not isinstance(emb, list) or len(emb) != dim:
                    raise RuntimeError(
                        f"{work_code}: bad embedding dim {len(emb) if isinstance(emb, list) else type(emb)}"
                    )
                cid = o.get("id") or f"{work_code}:{o.get('chunk_index')}"
                chunk_rows.append(
                    (
                        cid,
                        work_code,
                        o.get("collection") or collection,
                        int(o["chunk_index"]),
                        o.get("content_zh") or "",
                        o.get("title_zh") or title,
                        o.get("juan_no"),
                        o.get("juan_label"),
                        o.get("paragraph_no_start"),
                        o.get("paragraph_no_end"),
                        o.get("cbeta_ref_start"),
                        o.get("cbeta_ref_end"),
                        o.get("segment_count"),
                        o.get("char_count"),
                        o.get("overlap_prefix_chars"),
                    )
                )
                emb_rows.append((cid, vec_literal(emb), o.get("model") or model))
                n += 1
                if len(chunk_rows) >= 200:
                    _flush_chunks(cur, chunk_rows, emb_rows)
                    chunk_rows.clear()
                    emb_rows.clear()

        if chunk_rows:
            _flush_chunks(cur, chunk_rows, emb_rows)

        if expected and n != expected:
            # Allow empty works (chunk_count 0); otherwise warn but keep actual count
            pass

        cur.execute(
            """
            UPDATE works
            SET chunk_count = %s, status = 'embedded', embedded_at = now(), updated_at = now()
            WHERE work_code = %s
            """,
            (n, work_code),
        )
    conn.commit()
    return "ok" if n else "empty"


def _flush_chunks(cur, chunk_rows: list[tuple], emb_rows: list[tuple]) -> None:
    cur.executemany(
        """
        INSERT INTO chunks (
          id, work_code, collection, chunk_index, content_zh, title_zh,
          juan_no, juan_label, paragraph_no_start, paragraph_no_end,
          cbeta_ref_start, cbeta_ref_end, segment_count, char_count, overlap_prefix_chars
        ) VALUES (
          %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s,
          %s, %s, %s, %s, %s
        )
        """,
        chunk_rows,
    )
    cur.executemany(
        """
        INSERT INTO chunk_embeddings (chunk_id, embedding, model)
        VALUES (%s, %s::vector, %s)
        """,
        emb_rows,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Import CBETA JSONL vectors into database cbeta")
    ap.add_argument("--collections", nargs="+", default=["T"])
    _here = Path(__file__).resolve()
    _default_export = Path("/data")
    if len(_here.parents) >= 3:
        _default_export = _here.parents[2] / "data/cbeta/vector_export"
    ap.add_argument(
        "--export-dir",
        type=Path,
        default=_default_export,
    )
    ap.add_argument(
        "--dsn",
        default=os.getenv("CBETA_DATABASE_URL")
        or os.getenv("DATABASE_URL_CBETA")
        or "postgresql://tosuthien:thamthien@127.0.0.1:5432/cbeta",
    )
    ap.add_argument("--limit", type=int, default=0, help="Max works (0 = all)")
    ap.add_argument(
        "--drop-hnsw",
        action="store_true",
        help="Drop HNSW index before import (faster bulk); recreate at end",
    )
    args = ap.parse_args()

    print(f"DSN={args.dsn.split('@')[-1]}  export={args.export_dir}", flush=True)
    print(f"collections={args.collections}", flush=True)

    t0 = time.time()
    stats = {"ok": 0, "skip": 0, "empty": 0, "err": 0}

    with psycopg.connect(args.dsn, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database()")
            db = cur.fetchone()[0]
            if db != "cbeta":
                raise SystemExit(f"Refusing to import into database {db!r} (want 'cbeta')")
            if args.drop_hnsw:
                print("Dropping HNSW index for bulk load…", flush=True)
                cur.execute("DROP INDEX IF EXISTS idx_cbeta_chunk_embeddings_hnsw")
                conn.commit()

        for coll in args.collections:
            coll_dir = args.export_dir / coll
            metas = sorted(coll_dir.glob("*.meta.json"))
            if args.limit > 0:
                metas = metas[: args.limit]
            print(f"\n=== {coll}: {len(metas)} meta files ===", flush=True)
            for i, meta_path in enumerate(metas, 1):
                meta = load_meta(meta_path)
                if not meta or meta.get("status") != "done":
                    stats["err"] += 1
                    print(f"  skip bad meta {meta_path.name}", flush=True)
                    continue
                work_code = meta["work_code"]
                jsonl = coll_dir / f"{work_code}.jsonl"
                if not jsonl.is_file():
                    stats["err"] += 1
                    print(f"  missing jsonl {work_code}", flush=True)
                    continue
                try:
                    status = import_work(conn, jsonl, meta)
                    stats[status] = stats.get(status, 0) + 1
                except Exception as exc:  # noqa: BLE001
                    conn.rollback()
                    stats["err"] += 1
                    print(f"  ERR {work_code}: {exc}", flush=True)
                if i % 25 == 0 or i == len(metas):
                    print(
                        f"  [{i}/{len(metas)}] {stats}  elapsed={time.time()-t0:.0f}s",
                        flush=True,
                    )

        if args.drop_hnsw:
            print("Recreating HNSW index (may take a while)…", flush=True)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_cbeta_chunk_embeddings_hnsw
                      ON chunk_embeddings USING hnsw (embedding vector_cosine_ops)
                    """
                )
            conn.commit()

        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM works WHERE status = 'embedded'")
            w = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM chunks")
            c = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM chunk_embeddings")
            e = cur.fetchone()[0]
            print(f"\nDB totals: works_embedded={w} chunks={c} embeddings={e}", flush=True)

    print(f"done {stats} in {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
