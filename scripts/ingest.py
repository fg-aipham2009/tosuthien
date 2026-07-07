#!/usr/bin/env python3
"""
Ingest text/*.txt → rag_sources + passages.

Chunks Q&A pairs individually (not whole pages). Skips cover/boilerplate at ingest.
Reuses page-marker logic from text_to_word.py.
"""

from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
TEXT_DIR = BASE_DIR / "text"
sys.path.insert(0, str(BASE_DIR))

from text_to_word import parse_page_marker, skip, strip_markers, normalize_book_title  # noqa: E402

QA_START = re.compile(r"^\*{0,2}(\d+\.\s*)?HỎI\s*:", re.I)
KINH_DIALOGUE = re.compile(r"^Hỏi\s*:", re.I)
PHAM_START = re.compile(r"^PHẨM\s", re.I)
FOOTER_PAGE_RE = re.compile(r"Dịch giả\s*:\s*THÍCH DUY LỰC\s+(\d{1,4})", re.I)
OCR_PAGE_MARKER_RE = re.compile(r"^---\s*(\d{1,4})\s*---\s*$")
MAX_PROSE_CHARS = 3_500
MAX_QA_CHARS = 2_800

TITLE_OVERRIDES: dict[str, str] = {
    "21.txt": "ĐƯỜNG LỐI THỰC HÀNH THAM TỔ SƯ THIỀN",
}

SKIP_PATTERNS = [
    re.compile(r"^Trang này trống", re.I),
    re.compile(r"không có text nào", re.I),
    re.compile(r"^Hình ảnh được gửi", re.I),
    re.compile(r"^Bạn có thể gửi lại", re.I),
    re.compile(r"hoàn toàn trắng", re.I),
]

META_MARKERS = [
    "GIÁO HỘI PHẬT GIÁO",
    "NHÀ XUẤT BẢN",
    "THÀNH HỘI PHẬT GIÁO",
    "TỔ IN ẤN",
    "PL:",
    "DL:",
    "Dịch giả:",
    "Tái bản",
    "TRỌN BỘ",
    "LỜI NÓI ĐẦU",
    "LỜI ĐẦU SÁCH",
]


def should_skip_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if FOOTER_PAGE_RE.search(strip_markers(s)):
        return True
    if skip(s):
        return True
    return any(p.search(s) for p in SKIP_PATTERNS)


def parse_footer_page(line: str) -> int | None:
    """Printed page from OCR footer, e.g. 'Dịch giả : THÍCH DUY LỰC 233'."""
    m = FOOTER_PAGE_RE.search(strip_markers(line.strip()))
    return int(m.group(1)) if m else None


def detect_title_volume(lines: list[str]) -> tuple[str, str | None]:
    title = ""
    volume = None
    for raw in lines[:40]:
        s = strip_markers(raw.strip())
        if not s or is_meta_line(s):
            continue
        upper = s.upper()
        if "QUYỂN HẠ" in upper:
            volume = "QUYỂN HẠ"
        elif "QUYỂN THƯỢNG" in upper:
            volume = "QUYỂN THƯỢNG"
        norm = normalize_book_title(s)
        if len(norm) >= 8 and any(
            k in norm for k in ("NGỮ LỤC", "LUẬN", "KINH", "THIỀN", "PHẬT", "CỘI NGUỒN")
        ):
            title = norm
            if title:
                break
    if not title:
        title = "HT. Thích Duy Lực"
    return title, volume


def is_meta_line(s: str) -> bool:
    keys = ("GIÁO HỘI", "NHÀ XUẤT", "THÀNH HỘI", "TỔ IN", "Địa chỉ", "ĐT:", "Trụ sở")
    return any(k in s for k in keys)


def chunk_type_for(text: str) -> str:
    if QA_START.search(text.strip()):
        return "qa"
    if re.search(r"tụng\s*rằng", text, re.I) or re.match(r"^Thiên\s", text.strip()):
        return "verse"
    return "prose"


def extract_question_num(text: str) -> int | None:
    m = re.match(r"^\*{0,2}(\d+)\.\s*HỎI", text.strip(), re.I)
    return int(m.group(1)) if m else None


def is_qa_start(line: str) -> bool:
    s = line.strip()
    return bool(QA_START.match(s) or KINH_DIALOGUE.match(s))


def meta_marker_hits(text: str) -> int:
    upper = text.upper()
    return sum(1 for m in META_MARKERS if m in upper)


def is_junk_chunk(text: str, page_num: int | None, chunk_type: str) -> bool:
    """Drop cover pages, publisher boilerplate, and OCR noise at ingest time."""
    t = text.strip()
    if len(t) < 40:
        return True

    if any(p.search(t) for p in SKIP_PATTERNS) and len(t) < 250:
        return True

    meta = meta_marker_hits(t)
    upper = t.upper()

    # Publisher / cover blocks (common on tr.None pages)
    if meta >= 2 and len(t) < 1_200:
        return True
    if "NHÀ XUẤT BẢN" in upper and chunk_type != "qa" and len(t) < 1_500:
        return True
    if page_num is None and chunk_type == "prose":
        if meta >= 1 and len(t) < 800:
            return True
        if ("TÁI BẢN" in upper or "TRỌN BỘ" in upper) and len(t) < 1_200:
            return True

    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    if len(lines) <= 5 and meta >= 1 and chunk_type != "qa":
        return True

    return False


def split_long_prose(text: str) -> list[str]:
    """Split very long prose (no Q&A) so embedding sees more than the first tokens."""
    if len(text) <= MAX_PROSE_CHARS:
        return [text]
    parts: list[str] = []
    buf: list[str] = []
    buf_len = 0
    for para in re.split(r"\n\s*\n", text):
        p = para.strip()
        if not p:
            continue
        if buf_len + len(p) > MAX_PROSE_CHARS and buf:
            parts.append("\n\n".join(buf))
            buf = []
            buf_len = 0
        buf.append(p)
        buf_len += len(p)
    if buf:
        parts.append("\n\n".join(buf))
    return parts


def chunk_lines(lines: list[str]) -> list[dict]:
    """
    One passage per HỎI/ĐÁP pair. Prose without Q&A is kept per page (split if long).
    Q&A may span page markers — page_num is set when the question starts.
    """
    chunks: list[dict] = []
    page_num: int | None = None
    qa_page: int | None = None
    prose_buf: list[str] = []
    qa_buf: list[str] = []
    in_qa = False

    def append_chunk(text: str, pnum: int | None) -> None:
        ctype = chunk_type_for(text)
        if is_junk_chunk(text, pnum, ctype):
            return
        if ctype == "prose":
            for part in split_long_prose(text):
                if not is_junk_chunk(part, pnum, "prose"):
                    chunks.append(
                        {
                            "page_num": pnum,
                            "chunk_type": "prose",
                            "question_num": None,
                            "content": part,
                        }
                    )
        else:
            parts = split_long_prose(text) if len(text) > MAX_QA_CHARS else [text]
            for part in parts:
                if not is_junk_chunk(part, pnum, ctype):
                    chunks.append(
                        {
                            "page_num": pnum,
                            "chunk_type": ctype,
                            "question_num": extract_question_num(text),
                            "content": part,
                        }
                    )

    def flush_prose() -> None:
        nonlocal prose_buf
        if not prose_buf:
            return
        text = "\n".join(prose_buf).strip()
        prose_buf = []
        if text:
            append_chunk(text, page_num)

    def flush_qa() -> None:
        nonlocal qa_buf, in_qa, qa_page
        if not qa_buf:
            in_qa = False
            return
        text = "\n".join(qa_buf).strip()
        qa_buf = []
        in_qa = False
        if text:
            append_chunk(text, qa_page if qa_page is not None else page_num)
        qa_page = None

    for line in lines:
        s = line.strip()
        ocr_page = OCR_PAGE_MARKER_RE.match(s) if s else None
        if ocr_page:
            if in_qa:
                flush_qa()
            else:
                flush_prose()
            page_num = int(ocr_page.group(1))
            continue

        marker = parse_page_marker(s) if s else None
        if marker:
            if in_qa:
                flush_qa()
            else:
                flush_prose()
            page_num = marker[0]
            continue

        if s and PHAM_START.match(s):
            if in_qa:
                flush_qa()
            else:
                flush_prose()

        footer_page = parse_footer_page(line) if s else None
        if footer_page is not None:
            if in_qa:
                qa_page = footer_page
            else:
                flush_prose()
            page_num = footer_page
            continue

        if should_skip_line(line):
            continue

        if is_qa_start(line):
            flush_prose()
            flush_qa()
            qa_page = page_num
            qa_buf = [line.rstrip()]
            in_qa = True
            continue

        if in_qa:
            qa_buf.append(line.rstrip())
        else:
            prose_buf.append(line.rstrip())

    flush_prose()
    flush_qa()
    return chunks


def slug_for(source_file: str, title: str, volume: str | None) -> str:
    num = Path(source_file).stem
    base = re.sub(r"[^a-z0-9]+", "-", title.lower())
    base = re.sub(r"-+", "-", base).strip("-")[:40] or f"book-{num}"
    if volume:
        vol = "ha" if "HẠ" in volume else "thuong" if "THƯỢNG" in volume else volume.lower()
        return f"{base}-{vol}-{num}"
    return f"{base}-{num}"


def ingest_file(conn: psycopg.Connection, path: Path) -> int:
    lines = path.read_text(encoding="utf-8").splitlines()
    source_file = path.name
    title, volume = detect_title_volume(lines)
    title = TITLE_OVERRIDES.get(source_file, title)
    slug = slug_for(source_file, title, volume)

    chunks = chunk_lines(lines)
    now = datetime.now(timezone.utc)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO rag_sources (slug, title, volume, source_file, status, sort_order)
            VALUES (%s, %s, %s, %s, 'pending', %s)
            ON CONFLICT (source_file) DO UPDATE SET
              slug = EXCLUDED.slug,
              title = EXCLUDED.title,
              volume = EXCLUDED.volume
            RETURNING id
            """,
            (slug, title, volume, source_file, int(path.stem)),
        )
        rag_id = cur.fetchone()[0]

        cur.execute("DELETE FROM passages WHERE rag_source_id = %s", (rag_id,))

        for ch in chunks:
            cur.execute(
                """
                INSERT INTO passages (rag_source_id, page_num, chunk_type, question_num, content)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (rag_id, ch["page_num"], ch["chunk_type"], ch["question_num"], ch["content"]),
            )

        cur.execute(
            """
            UPDATE rag_sources
            SET status = 'ingested', chunk_count = %s, ingested_at = %s
            WHERE id = %s
            """,
            (len(chunks), now, rag_id),
        )

    return len(chunks)


def main() -> None:
    load_dotenv(BASE_DIR / ".env")
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise SystemExit("DATABASE_URL not set in .env")

    targets = [TEXT_DIR / f"{i}.txt" for i in range(1, 22)]
    existing = [p for p in targets if p.exists()]
    missing = [p for p in targets if not p.exists()]

    print(f"📚 Ingest {len(existing)} file text → rag_sources + passages (Q&A chunks + cover filter)")
    if missing:
        print(f"⚠️  Thiếu file: {', '.join(p.name for p in missing)}")

    total_chunks = 0
    qa_total = 0
    with psycopg.connect(db_url) as conn:
        for path in existing:
            n = ingest_file(conn, path)
            total_chunks += n
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(*) FROM passages p
                    JOIN rag_sources r ON r.id = p.rag_source_id
                    WHERE r.source_file = %s AND p.chunk_type = 'qa'
                    """,
                    (path.name,),
                )
                qa_total += cur.fetchone()[0]
            print(f"  ✅ {path.name}: {n} passages")
        conn.commit()

    print(f"\n🎉 Xong — {len(existing)} nguồn, {total_chunks} passages ({qa_total} Q&A)")
    print("   Bước sau: python3 scripts/embed.py --all --create-index")


if __name__ == "__main__":
    main()
