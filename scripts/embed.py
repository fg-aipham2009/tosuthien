#!/usr/bin/env python3
"""
Embed passages → passage_embeddings (pgvector).

Requires: ingest.py đã chạy, API key trong .env

Usage:
  python3 scripts/embed.py                 # chỉ passages chưa có vector
  python3 scripts/embed.py --all           # embed lại toàn bộ
  python3 scripts/embed.py --source 13.txt # một file
  python3 scripts/embed.py --create-index  # HNSW index (chạy sau embed)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from tqdm import tqdm

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DIM = 384
MAX_CHARS = 12_000
BATCH_SIZE = 32


def load_config() -> dict:
    load_dotenv(BASE_DIR / ".env")

    shop_key = os.getenv("SHOPAIKEY_API_KEY", "")
    api_key = (
        os.getenv("EMBEDDING_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or shop_key
    )
    if not api_key:
        raise SystemExit(
            "Thiếu EMBEDDING_API_KEY (hoặc OPENAI_API_KEY / SHOPAIKEY_API_KEY) trong .env"
        )

    shop_base = os.getenv("SHOPAIKEY_BASE_URL", "https://api.shopaikey.com").rstrip("/")
    embed_base = os.getenv("EMBEDDING_BASE_URL") or os.getenv("OPENAI_BASE_URL")
    if embed_base:
        base_url = embed_base.rstrip("/")
    elif os.getenv("EMBEDDING_API_KEY") or os.getenv("OPENAI_API_KEY"):
        base_url = "https://api.openai.com/v1"
    elif shop_key and api_key == shop_key:
        print(
            "⚠️  ShopAIKey thường không hỗ trợ embedding.\n"
            "   Thêm OPENAI_API_KEY hoặc EMBEDDING_API_KEY + EMBEDDING_BASE_URL vào .env"
        )
        base_url = f"{shop_base}/v1"
    else:
        base_url = "https://api.openai.com/v1"

    model = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    dimensions = int(os.getenv("EMBEDDING_DIM", str(DEFAULT_DIM)))
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise SystemExit("Thiếu DATABASE_URL trong .env")

    if dimensions != DEFAULT_DIM:
        print(f"⚠️  EMBEDDING_DIM={dimensions} khác schema vector({DEFAULT_DIM})")

    return {
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
        "dimensions": dimensions,
        "db_url": db_url,
    }


def truncate(text: str) -> str:
    text = text.strip()
    return text if len(text) <= MAX_CHARS else text[:MAX_CHARS]


def embed_batch(texts: list[str], cfg: dict) -> list[list[float]]:
    url = f"{cfg['base_url']}/embeddings"
    body = {"model": cfg["model"], "input": texts, "dimensions": cfg["dimensions"]}
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {cfg['api_key']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Embedding API {e.code}: {e.read().decode()[:500]}") from e

    items = sorted(data["data"], key=lambda x: x["index"])
    vectors = [item["embedding"] for item in items]
    if len(vectors) != len(texts):
        raise RuntimeError(f"API trả {len(vectors)} vectors, cần {len(texts)}")
    return vectors


def vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in values) + "]"


def fetch_passages(conn: psycopg.Connection, source_file: str | None, reembed: bool) -> list[tuple]:
    sql = """
        SELECT p.id, p.content, r.source_file, r.id AS rag_source_id
        FROM passages p
        JOIN rag_sources r ON r.id = p.rag_source_id
    """
    params: list = []
    clauses: list[str] = []

    if source_file:
        clauses.append("r.source_file = %s")
        params.append(source_file)

    if not reembed:
        clauses.append(
            "NOT EXISTS (SELECT 1 FROM passage_embeddings e WHERE e.passage_id = p.id)"
        )

    if clauses:
        sql += " WHERE " + " AND ".join(clauses)

    sql += " ORDER BY r.sort_order, p.page_num NULLS FIRST, p.created_at"

    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def upsert_embeddings(
    conn: psycopg.Connection,
    rows: list[tuple],
    vectors: list[list[float]],
    model: str,
    dim: int,
) -> None:
    params = [
        (row[0], vector_literal(vec), model)
        for row, vec in zip(rows, vectors)
        if len(vec) == dim
    ]
    if len(params) != len(rows):
        raise ValueError(f"Vector dim != {dim}")

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO passage_embeddings (passage_id, embedding, model)
            VALUES (%s, %s::vector, %s)
            ON CONFLICT (passage_id) DO UPDATE SET
              embedding = EXCLUDED.embedding,
              model = EXCLUDED.model,
              created_at = now()
            """,
            params,
        )


def update_rag_status(conn: psycopg.Connection, source_file: str | None) -> None:
    now = datetime.now(timezone.utc)
    sql = """
        UPDATE rag_sources r
        SET status = 'embedded',
            embedded_at = %s,
            chunk_count = (
              SELECT COUNT(*) FROM passages p WHERE p.rag_source_id = r.id
            )
        WHERE NOT EXISTS (
          SELECT 1 FROM passages p
          LEFT JOIN passage_embeddings e ON e.passage_id = p.id
          WHERE p.rag_source_id = r.id AND e.passage_id IS NULL
        )
    """
    params: list = [now]
    if source_file:
        sql += " AND r.source_file = %s"
        params.append(source_file)

    with conn.cursor() as cur:
        cur.execute(sql, params)


def create_hnsw_index(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_passage_embeddings_hnsw
              ON passage_embeddings USING hnsw (embedding vector_cosine_ops)
            """
        )
    print("✅ HNSW index idx_passage_embeddings_hnsw")


def main() -> None:
    parser = argparse.ArgumentParser(description="Embed passages for RAG")
    parser.add_argument("--all", action="store_true", help="Embed lại cả passages đã có vector")
    parser.add_argument("--source", help="Chỉ một file, vd 13.txt")
    parser.add_argument("--create-index", action="store_true", help="Tạo HNSW index sau embed")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    args = parser.parse_args()

    cfg = load_config()
    print(f"🔢 {cfg['base_url']}  model={cfg['model']}  dim={cfg['dimensions']}  batch={args.batch_size}")

    with psycopg.connect(cfg["db_url"]) as conn:
        rows = fetch_passages(conn, args.source, args.all)
        if not rows:
            print("Không có passage cần embed.")
            if args.create_index:
                create_hnsw_index(conn)
                conn.commit()
            return

        print(f"📦 {len(rows)} passages cần embed")
        t0 = time.time()

        for i in tqdm(range(0, len(rows), args.batch_size), desc="Embedding"):
            batch = rows[i : i + args.batch_size]
            texts = [truncate(content) for (_id, content, _src, _rag) in batch]

            for attempt in range(3):
                try:
                    vectors = embed_batch(texts, cfg)
                    break
                except RuntimeError as e:
                    if attempt == 2:
                        raise
                    wait = 2**attempt
                    print(f"\n⚠️  Retry sau {wait}s: {e}")
                    time.sleep(wait)

            upsert_embeddings(conn, batch, vectors, cfg["model"], cfg["dimensions"])
            conn.commit()

        update_rag_status(conn, args.source)
        if args.create_index:
            create_hnsw_index(conn)
        conn.commit()

        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM passage_embeddings")
            total = cur.fetchone()[0]

    elapsed = time.time() - t0
    print(f"\n🎉 Xong — {total} vectors ({elapsed:.0f}s)")
    print("   Test: POST http://localhost:8000/api/rag/chat  {\"question\":\"...\"}")


if __name__ == "__main__":
    main()
