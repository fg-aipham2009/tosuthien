#!/usr/bin/env python3
"""
Fetch modern Chan master corpora (not in CBETA) → embed → JSONL under vector_export.

Sources (recorded in every work metadata / source_xml):
  - 虛雲: 禪心學苑「虛雲和尚全集」= 岑學呂編《年譜》+《法彙》六種
    https://tripitaka2.zensoul.org/zushi/XY
  - 來果: 佛音網《來果禪師開示錄》(高旻寺禪七 1942)
    https://www.book.bfnn.org/books2/1137.htm
    (Full 7-vol 《語錄》紙本 not freely mirrored here; 開示錄 is the largest clean digital set.)

Usage:
  python3 scripts/canon/ingest_master_texts.py
  python3 scripts/canon/ingest_master_texts.py --import-db
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from embed_zh_export import embed_batch, load_embed_cfg  # noqa: E402
from translate_work import batches  # noqa: E402 — needs Segment-like? actually batches expects objects with content_zh

OUT = ROOT / "data/cbeta/vector_export"
UA = {"User-Agent": "tosuthien-cbeta-ingest/1.0 (personal study; contact local)"}
BATCH_CHARS = int(os.getenv("CANON_EMBED_BATCH_CHARS", "1200"))
OVERLAP = int(os.getenv("CANON_EMBED_OVERLAP_CHARS", "120"))
HTTP_BATCH = int(os.getenv("EMBED_BATCH", "8"))


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._skip = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "nav", "header", "footer", "aside"}:
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "nav", "header", "footer", "aside"} and self._skip:
            self._skip -= 1
        if tag in {"p", "br", "div", "li", "h1", "h2", "h3", "h4", "tr"} and not self._skip:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        raw = resp.read()
        declared = (resp.headers.get_content_charset() or "").strip()
    # bfnn pages are often Big5 (HKSCS); Zen Soul is UTF-8
    for enc in (declared, "utf-8", "big5hkscs", "big5", "gb18030", "gbk"):
        if not enc:
            continue
        try:
            return raw.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("utf-8", errors="replace")


def html_to_text(html: str) -> str:
    # Prefer article.sutra body when present
    m = re.search(r'<article[^>]*class="[^"]*sutra[^"]*"[^>]*>([\s\S]*?)</article>', html, re.I)
    if not m:
        m = re.search(r"<article[^>]*>([\s\S]*?)</article>", html, re.I)
    chunk = m.group(1) if m else html
    chunk = re.sub(r"<script[\s\S]*?</script>", "", chunk, flags=re.I)
    p = _TextExtractor()
    p.feed(chunk)
    text = "".join(p.parts)
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def paragraphs(text: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if len(parts) <= 1:
        # hard wrap long blocks
        parts = [p.strip() for p in text.split("\n") if p.strip()]
    return parts


class _Seg:
    __slots__ = ("content_zh", "juan_no", "juan_label", "paragraph_no", "cbeta_ref")

    def __init__(self, content_zh: str, juan_no: int, para: int):
        self.content_zh = content_zh
        self.juan_no = juan_no
        self.juan_label = f"卷{juan_no}" if juan_no else ""
        self.paragraph_no = para
        self.cbeta_ref = None


def pack_text(text: str, batch_chars: int, overlap: int) -> list[dict]:
    paras = paragraphs(text)
    segs = [_Seg(p, 1, i + 1) for i, p in enumerate(paras)]
    groups = batches(segs, batch_chars)
    chunks: list[dict] = []
    prev = ""
    for bi, group in enumerate(groups):
        body = "".join(s.content_zh for s in group)
        if not body.strip():
            continue
        prefix = prev[-overlap:] if overlap and prev else ""
        content = prefix + body
        chunks.append(
            {
                "chunk_index": bi,
                "juan_no": group[0].juan_no,
                "juan_label": group[0].juan_label,
                "paragraph_no_start": group[0].paragraph_no,
                "paragraph_no_end": group[-1].paragraph_no,
                "cbeta_ref_start": None,
                "cbeta_ref_end": None,
                "segment_count": len(group),
                "char_count": len(content),
                "overlap_prefix_chars": len(prefix),
                "content_zh": content,
            }
        )
        prev = body
    return chunks


def write_work(
    coll: str,
    work_code: str,
    title_zh: str,
    text: str,
    source: dict,
    cfg: dict,
) -> str:
    coll_dir = OUT / coll
    coll_dir.mkdir(parents=True, exist_ok=True)
    out_path = coll_dir / f"{work_code}.jsonl"
    meta_path = coll_dir / f"{work_code}.meta.json"
    chunks = pack_text(text, BATCH_CHARS, OVERLAP)
    meta = {
        "work_code": work_code,
        "collection": coll,
        "title_zh": title_zh,
        "source_xml": source.get("url") or source.get("source_label"),
        "chunk_count": len(chunks),
        "status": "done",
        "model": cfg["model"],
        "dim": cfg["dimensions"],
        "batch_chars": BATCH_CHARS,
        "overlap_chars": OVERLAP,
        "source": source,
    }
    if meta_path.is_file():
        try:
            old = json.loads(meta_path.read_text(encoding="utf-8"))
            if (
                old.get("status") == "done"
                and int(old.get("chunk_count", -1)) == len(chunks)
                and out_path.is_file()
                and out_path.stat().st_size > 0
            ):
                print(f"  skip {work_code} ({len(chunks)} chunks)", flush=True)
                return "skip"
        except Exception:
            pass

    print(f"  embed {work_code} title={title_zh!r} chars={len(text)} chunks={len(chunks)}", flush=True)
    tmp = out_path.with_suffix(".jsonl.tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        for i in range(0, len(chunks), HTTP_BATCH):
            batch = chunks[i : i + HTTP_BATCH]
            texts = [c["content_zh"] for c in batch]
            for attempt in range(8):
                try:
                    vectors = embed_batch(texts, cfg)
                    break
                except Exception as exc:
                    if attempt == 7:
                        raise
                    time.sleep(min(60, 2**attempt))
                    print(f"    retry {work_code}@{i}: {exc}", flush=True)
            for chunk, vec in zip(batch, vectors):
                row = {
                    "id": f"{work_code}:{chunk['chunk_index']}",
                    "collection": coll,
                    "work_code": work_code,
                    "title_zh": title_zh,
                    "model": cfg["model"],
                    "dim": cfg["dimensions"],
                    **{k: v for k, v in chunk.items() if k != "content_zh"},
                    "content_zh": chunk["content_zh"],
                    "embedding": vec,
                    "source": source,
                }
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    tmp.replace(out_path)
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return "ok"


XY_WORKS = [
    ("XY0001", 14, "虛雲和尚年譜"),
    ("XY0002", 4, "虛雲和尚法彙・法語"),
    ("XY0003", 2, "虛雲和尚法彙・開示"),
    ("XY0004", 2, "虛雲和尚法彙・書問"),
    ("XY0005", 4, "虛雲和尚法彙・文記"),
    ("XY0006", 2, "虛雲和尚法彙・規約"),
    ("XY0007", 3, "虛雲和尚法彙・詩歌偈贊"),
]


def ingest_xuyun(cfg: dict) -> None:
    print("=== 虛雲和尚全集（禪心學苑／岑學呂法彙＋年譜）===", flush=True)
    for code, n_juans, title in XY_WORKS:
        parts: list[str] = []
        urls: list[str] = []
        for j in range(1, n_juans + 1):
            url = f"https://tripitaka2.zensoul.org/XY/{code}/{j}"
            html = fetch(url)
            if "找不到" in html[:800]:
                print(f"  miss {url}", flush=True)
                continue
            t = html_to_text(html)
            # Drop chrome crumbs
            t = re.sub(r"‹\s*上一篇[\s\S]{0,80}?下一篇\s*›", "", t)
            t = re.sub(r"本篇目次[\s\S]{0,200}?(?=\n\S)", "", t, count=1)
            parts.append(t)
            urls.append(url)
            time.sleep(0.35)
        text = "\n\n".join(p for p in parts if p.strip())
        source = {
            "source_label": "虛雲和尚全集（岑學呂編《年譜》＋《法彙》六種）",
            "publisher": "禪心學苑・大藏經",
            "editor": "岑學呂",
            "master": "虛雲",
            "canon_note": "CBETA未收；站方目錄名「虛雲和尚全集」。非淨慧主編九冊紙本全集。",
            "url": "https://tripitaka2.zensoul.org/zushi/XY",
            "juan_urls": urls,
            "license_note": "個人研讀／非營利；見 https://tripitaka2.zensoul.org/license",
        }
        write_work("XY", code, title, text, source, cfg)


def ingest_laiguo(cfg: dict) -> None:
    print("=== 來果禪師開示錄（佛音網；語錄系文本）===", flush=True)
    url = "https://www.book.bfnn.org/books2/1137.htm"
    html = fetch(url)
    text = html_to_text(html)
    # Strip site chrome
    text = re.sub(r"StatCounter[\s\S]*$", "", text)
    text = re.sub(r"https?://\S+", "", text)
    source = {
        "source_label": "來果禪師開示錄（揚州高旻寺禪七，民國三十一年／1942）",
        "publisher": "佛音網站 bfnn.org",
        "master": "來果",
        "canon_note": "屬來果禪師語錄／禪七開示系統。CBETA僅有《高旻寺規約》(B18n0098)。七卷紙本《來果禪師語錄》全文未在此源完整收錄。",
        "url": url,
        "mirror": "http://www.bfnn.org/book/books2/1137.htm",
        "license_note": "佛音網公開流通文本；供個人研讀／非營利",
    }
    write_work("LQ", "LQ0001", "來果禪師開示錄", text, source, cfg)


def seed_and_import(collections: list[str]) -> None:
    import subprocess

    dsn = os.getenv("CBETA_DATABASE_URL") or "postgresql://tosuthien:thamthien@127.0.0.1:15432/cbeta"
    # Ensure tunnel
    import socket

    host, port = "127.0.0.1", 15432
    try:
        socket.create_connection((host, port), timeout=3).close()
    except OSError:
        print("Opening SSH tunnel…", flush=True)
        subprocess.check_call(
            [
                "ssh",
                "-f",
                "-N",
                "-o",
                "ExitOnForwardFailure=yes",
                "-o",
                "ServerAliveInterval=30",
                "-L",
                "15432:127.0.0.1:5432",
                "tosuthien-vps2",
            ]
        )
        time.sleep(1)

    import psycopg

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO collections (code, name_zh, name_vi, sort_order) VALUES
                  ('XY', '虛雲和尚全集（岑學呂法彙＋年譜）', 'Hư Vân toàn tập (Pháp hội + Niên phổ)', 90),
                  ('LQ', '來果禪師語錄／開示錄', 'Lai Quả ngữ lục / khai thị lục', 91)
                ON CONFLICT (code) DO UPDATE SET
                  name_zh = EXCLUDED.name_zh,
                  name_vi = EXCLUDED.name_vi
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS collection_aliases (
                  id               bigserial PRIMARY KEY,
                  collection_code  text NOT NULL REFERENCES collections (code) ON DELETE CASCADE,
                  alias            text NOT NULL,
                  created_at       timestamptz NOT NULL DEFAULT now(),
                  UNIQUE (collection_code, alias)
                )
                """
            )
            cur.execute(
                """
                INSERT INTO collection_aliases (collection_code, alias) VALUES
                  ('XY', '虛雲'),
                  ('XY', 'hư vân'),
                  ('XY', 'xuyun'),
                  ('LQ', '來果'),
                  ('LQ', 'lai quả'),
                  ('LQ', 'laiguo')
                ON CONFLICT (collection_code, alias) DO NOTHING
                """
            )
        conn.commit()

    cmd = [
        sys.executable,
        "-u",
        str(ROOT / "scripts/canon/import_vector_export.py"),
        "--collections",
        *collections,
        "--export-dir",
        str(OUT),
        "--dsn",
        dsn,
    ]
    print("IMPORT", " ".join(cmd), flush=True)
    subprocess.check_call(cmd)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-fetch-embed", action="store_true")
    ap.add_argument("--import-db", action="store_true", help="Import XY+LQ into VPS cbeta via tunnel")
    ap.add_argument("--only", choices=["xy", "lq", "all"], default="all")
    args = ap.parse_args()

    cfg = load_embed_cfg()
    if not args.skip_fetch_embed:
        if args.only in ("xy", "all"):
            ingest_xuyun(cfg)
        if args.only in ("lq", "all"):
            ingest_laiguo(cfg)
    if args.import_db:
        cols = []
        if args.only in ("xy", "all"):
            cols.append("XY")
        if args.only in ("lq", "all"):
            cols.append("LQ")
        seed_and_import(cols)
    print("done", flush=True)


if __name__ == "__main__":
    main()
