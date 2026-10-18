#!/usr/bin/env python3
"""
Embed CBETA Chinese originals (T / X) → local JSONL export for upload.

Does NOT write tosuthien book RAG (rag_sources kind=book) or VPS passages.
Uses local embed_server (OpenAI-compatible) + cbeta_parser + translate_work.batches.

Chunking (BGE-M3 best practice — https://huggingface.co/BAAI/bge-m3 ):
  - Model max sequence length = 8192 tokens; dense dim = 1024; no query instruction prefix.
  - Pack paragraph groups toward CANON_EMBED_BATCH_CHARS (Q&A best practice: ~1200 CJK chars
    ≈ BGE-M3 ~512 tokens; BAAI recommends ~512-token chunks over whole-doc 8192).
  - Optional overlap ~10% (CANON_EMBED_OVERLAP_CHARS, e.g. 120 with batch 1200).
  - Later retrieval: hybrid (dense + FTS/BM25) + rerank — not done in this export script.

Usage:
  CANON_EMBED_BATCH_CHARS=4096 CANON_EMBED_OVERLAP_CHARS=400 \\
  python3 scripts/canon/embed_zh_export.py --collections X T --batch-chars 4096

Resume: skips works whose .meta.json matches chunk_count + batch_chars + status=done.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv
from tqdm import tqdm

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from cbeta_parser import parse_file, work_title  # noqa: E402
from translate_work import batches  # noqa: E402

# Same ceiling as scripts/embed.py when sending text to the embed API.
EMBED_MAX_CHARS = int(os.getenv("EMBEDDING_MAX_CHARS", "12000"))


def load_embed_cfg() -> dict:
    load_dotenv(ROOT / ".env")
    api_key = os.getenv("EMBEDDING_API_KEY") or "local"
    base = (os.getenv("EMBEDDING_BASE_URL") or "http://127.0.0.1:7997/v1").rstrip("/")
    model = os.getenv("EMBEDDING_MODEL") or "BAAI/bge-m3"
    dim = int(os.getenv("EMBEDDING_DIM") or "1024")
    return {"api_key": api_key, "base_url": base, "model": model, "dimensions": dim}


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
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.loads(resp.read().decode())
    items = sorted(data["data"], key=lambda x: x["index"])
    vectors = [item["embedding"] for item in items]
    if len(vectors) != len(texts):
        raise RuntimeError(f"got {len(vectors)} vectors, need {len(texts)}")
    if vectors and len(vectors[0]) != cfg["dimensions"]:
        raise RuntimeError(f"dim {len(vectors[0])} != {cfg['dimensions']}")
    return vectors


def list_xml(xml_root: Path, collections: list[str]) -> list[tuple[str, Path]]:
    out: list[tuple[str, Path]] = []
    for coll in collections:
        base = xml_root / coll
        if not base.is_dir():
            print(f"⚠️  missing collection dir: {base}", flush=True)
            continue
        for path in sorted(base.glob(f"{coll}*/{coll}*n*.xml")):
            out.append((coll, path))
    return out


def pack_chunks(segments, batch_chars: int, overlap_chars: int = 0) -> list[dict]:
    """Pack by paragraph groups; optionally prepend trailing text from previous chunk."""
    groups = batches(segments, batch_chars)
    chunks: list[dict] = []
    prev_text = ""
    for bi, group in enumerate(groups):
        body = "".join(s.content_zh for s in group)
        if not body.strip():
            continue
        prefix = ""
        if overlap_chars > 0 and prev_text:
            prefix = prev_text[-overlap_chars:]
        text = prefix + body
        if len(text) > EMBED_MAX_CHARS:
            text = text[:EMBED_MAX_CHARS]
        chunks.append(
            {
                "chunk_index": bi,
                "juan_no": group[0].juan_no,
                "juan_label": group[0].juan_label,
                "paragraph_no_start": group[0].paragraph_no,
                "paragraph_no_end": group[-1].paragraph_no,
                "cbeta_ref_start": group[0].cbeta_ref,
                "cbeta_ref_end": group[-1].cbeta_ref,
                "segment_count": len(group),
                "char_count": len(text),
                "overlap_prefix_chars": len(prefix),
                "content_zh": text,
            }
        )
        prev_text = body
    return chunks


def work_done(
    out_path: Path,
    expected_chunks: int,
    batch_chars: int,
    overlap_chars: int,
) -> bool:
    if not out_path.is_file():
        return False
    meta_path = out_path.with_suffix(".meta.json")
    if not meta_path.is_file():
        return False
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False
    return (
        meta.get("status") == "done"
        and int(meta.get("chunk_count", -1)) == expected_chunks
        and int(meta.get("batch_chars", -1)) == batch_chars
        and int(meta.get("overlap_chars", 0)) == overlap_chars
        and out_path.stat().st_size > 0
    )


def embed_work(
    coll: str,
    path: Path,
    out_dir: Path,
    batch_chars: int,
    overlap_chars: int,
    http_batch: int,
    cfg: dict,
) -> str:
    work_code = path.stem
    coll_dir = out_dir / coll
    coll_dir.mkdir(parents=True, exist_ok=True)
    out_path = coll_dir / f"{work_code}.jsonl"
    meta_path = coll_dir / f"{work_code}.meta.json"

    segments = parse_file(path, coll)
    chunks = pack_chunks(segments, batch_chars, overlap_chars)
    title = work_title(path) or work_code

    err_path = coll_dir / f"{work_code}.error.txt"

    if work_done(out_path, len(chunks), batch_chars, overlap_chars):
        # Prior failure leftover — drop after successful resume/skip.
        if err_path.exists():
            err_path.unlink()
        return "skip"

    if not chunks:
        meta_path.write_text(
            json.dumps(
                {
                    "work_code": work_code,
                    "collection": coll,
                    "title_zh": title,
                    "source_xml": _rel(path),
                    "chunk_count": 0,
                    "status": "done",
                    "model": cfg["model"],
                    "dim": cfg["dimensions"],
                    "batch_chars": batch_chars,
                    "overlap_chars": overlap_chars,
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        out_path.write_text("", encoding="utf-8")
        if err_path.exists():
            err_path.unlink()
        return "empty"

    tmp = out_path.with_suffix(".jsonl.tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        for i in range(0, len(chunks), http_batch):
            batch = chunks[i : i + http_batch]
            texts = [c["content_zh"] for c in batch]
            for attempt in range(8):
                try:
                    vectors = embed_batch(texts, cfg)
                    break
                except (urllib.error.HTTPError, urllib.error.URLError, RuntimeError, TimeoutError) as exc:
                    code = getattr(exc, "code", None)
                    if attempt == 7:
                        raise
                    # 503 = embed server busy; back off longer so slots clear.
                    wait = 5 * (attempt + 1) if code == 503 else min(60, 2**attempt)
                    print(f"\n  retry {work_code} batch@{i} wait={wait}s: {exc}", flush=True)
                    time.sleep(wait)
            for chunk, vec in zip(batch, vectors):
                row = {
                    "id": f"{work_code}:{chunk['chunk_index']}",
                    "collection": coll,
                    "work_code": work_code,
                    "title_zh": title,
                    "model": cfg["model"],
                    "dim": cfg["dimensions"],
                    **{k: v for k, v in chunk.items() if k != "content_zh"},
                    "content_zh": chunk["content_zh"],
                    "embedding": vec,
                }
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    tmp.replace(out_path)
    meta_path.write_text(
        json.dumps(
            {
                "work_code": work_code,
                "collection": coll,
                "title_zh": title,
                "source_xml": _rel(path),
                "chunk_count": len(chunks),
                "status": "done",
                "model": cfg["model"],
                "dim": cfg["dimensions"],
                "batch_chars": batch_chars,
                "overlap_chars": overlap_chars,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    if err_path.exists():
        err_path.unlink()
    return "ok"


def _rel(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT.resolve()))
    except ValueError:
        return str(path)


def main() -> None:
    env_chars = os.getenv("CANON_EMBED_BATCH_CHARS")
    env_overlap = os.getenv("CANON_EMBED_OVERLAP_CHARS")
    ap = argparse.ArgumentParser(description="Export CBETA ZH embeddings to JSONL")
    ap.add_argument("--collections", nargs="+", default=["X", "T"], help="Canon codes")
    ap.add_argument(
        "--batch-chars",
        type=int,
        default=int(env_chars) if env_chars else None,
        help="Pack size (CJK chars); or CANON_EMBED_BATCH_CHARS. BGE-M3 max 8192 tokens.",
    )
    ap.add_argument(
        "--overlap-chars",
        type=int,
        default=int(env_overlap) if env_overlap else 0,
        help="Overlap prefix from previous chunk; or CANON_EMBED_OVERLAP_CHARS",
    )
    ap.add_argument("--xml-root", type=Path, default=ROOT / "data/cbeta/xml-p5")
    ap.add_argument("--out-dir", type=Path, default=ROOT / "data/cbeta/vector_export")
    # Smaller HTTP batches = shorter lock hold on embed_server, fewer timeouts.
    ap.add_argument("--http-batch", type=int, default=int(os.getenv("EMBED_BATCH", "8")))
    ap.add_argument("--limit", type=int, default=0, help="Max works (0 = all); for smoke tests")
    args = ap.parse_args()

    if not args.batch_chars or args.batch_chars < 1:
        raise SystemExit(
            "Need --batch-chars N or CANON_EMBED_BATCH_CHARS "
            "(BGE-M3 supports up to 8192 tokens; ~4096 CJK chars is a solid default)"
        )
    if args.overlap_chars < 0 or args.overlap_chars >= args.batch_chars:
        raise SystemExit("--overlap-chars must be >= 0 and < --batch-chars")

    cfg = load_embed_cfg()
    works = list_xml(args.xml_root, args.collections)
    if args.limit > 0:
        works = works[: args.limit]

    print(
        f"📚 {len(works)} XML · collections={args.collections} · "
        f"batch_chars={args.batch_chars} · overlap={args.overlap_chars} · "
        f"http_batch={args.http_batch}",
        flush=True,
    )
    print(f"🔢 {cfg['base_url']}  model={cfg['model']}  dim={cfg['dimensions']}", flush=True)
    print(f"📁 out={args.out_dir}", flush=True)

    stats = {"ok": 0, "skip": 0, "empty": 0, "err": 0}
    for coll, path in tqdm(works, desc="CBETA ZH embed"):
        try:
            status = embed_work(
                coll,
                path,
                args.out_dir,
                args.batch_chars,
                args.overlap_chars,
                args.http_batch,
                cfg,
            )
            stats[status] = stats.get(status, 0) + 1
        except Exception as exc:  # noqa: BLE001 — keep batch going; log and continue
            stats["err"] += 1
            err_path = args.out_dir / coll / f"{path.stem}.error.txt"
            err_path.parent.mkdir(parents=True, exist_ok=True)
            err_path.write_text(f"{path}\n{exc}\n", encoding="utf-8")
            print(f"\n❌ {path.stem}: {exc}", flush=True)

    manifest = {
        "collections": args.collections,
        "batch_chars": args.batch_chars,
        "overlap_chars": args.overlap_chars,
        "model": cfg["model"],
        "dim": cfg["dimensions"],
        "stats": stats,
        "work_count": len(works),
        "notes": "BGE-M3 dense 1024-d, max_length 8192 tokens; hybrid+rerank recommended at query time",
    }
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"\n🎉 done {stats}", flush=True)


if __name__ == "__main__":
    main()
