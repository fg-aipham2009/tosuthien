#!/usr/bin/env python3
"""
Normalize OCR book text into clean per-page files for the "Đọc chữ" reader.

IMPORTANT: Never modifies original text/{id}.txt (those stay for RAG embed).

Workflow:
  1. Read-only from text/{id}.txt
  2. Copy each source into text/doc-chu/source/{id}.txt
  3. Write cleaned book under text/doc-chu/books/{id}/
     - Page filenames keep printed book numbers (0001.txt = trang 1)
     - Blank pages are omitted (no file written)
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = BASE_DIR / "text"
DEFAULT_WORKSPACE = BASE_DIR / "text" / "doc-chu"
DEFAULT_SOURCE_COPY = DEFAULT_WORKSPACE / "source"
DEFAULT_OUTPUT = DEFAULT_WORKSPACE / "books"

sys.path.insert(0, str(BASE_DIR))
from text_to_word import parse_page_marker, strip_markers  # noqa: E402

PAGE_MARKER_RE = re.compile(r"^---\s*(\d+)\s*---\s*$", re.MULTILINE)
OCR_LINE_RE = re.compile(r"^---\s*(\d+)\s*---\s*$")
FOOTER_PAGE_RE = re.compile(r"Dịch giả\s*:\s*THÍCH DUY LỰC\s+(\d{1,4})", re.I)
BLANK_PAGE_RE = re.compile(
    r"^trang này trống.*$",
    re.IGNORECASE | re.MULTILINE,
)
MARKDOWN_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
MARKDOWN_ITALIC_RE = re.compile(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)")
BULLET_RE = re.compile(r"^[➢►•●]\s*")
ONLY_PAGE_NUM_RE = re.compile(r"^\d{1,4}$")
RUNNING_HEADER_RE = re.compile(
    r"^\s*\d{1,4}\s{2,}.{0,80}$|^\s*.{0,80}\s{2,}\d{1,4}\s*$"
)
RUNNING_TITLE_RE = re.compile(
    r"^\d{1,4}\s+[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s\-:]{4,70}$"
    r"|^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s\-:]{4,70}\s+\d{1,4}$"
)
DECORATION_RE = re.compile(r"^[᯽※✦✧◆◇❖✵✰★☆▪▫■□\-–—oO0]{3,}$|^-*[oO0]+-*$")
MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")
MULTI_BLANK_RE = re.compile(r"\n{3,}")

TITLE_OVERRIDES: dict[str, str] = {
    "1.txt": "NAM TUYỀN NGỮ LỤC VÀ BỬU TẠNG LUẬN",
    "2.txt": "PHẬT PHÁP VỚI THIỀN TÔNG",
    "3.txt": "CHƯ KINH TẬP YẾU",
    "4.txt": "KINH PHÁP BẢO ĐÀN",
    "5.txt": "TRUNG PHONG PHÁP NGỮ · LÂM TẾ NGỮ LỤC",
    "6.txt": "PHẬT PHÁP VÀ KHOA HỌC",
    "7.txt": "THAM THIỀN PHỔ THUYẾT",
    "8.txt": "GÓP NHẶT LỜI PHẬT TỔ VÀ THÁNH HIỆN",
    "9.txt": "LƯỢC GIẢNG BỒ TÁT GIỚI",
    "10.txt": "VŨ TRỤ QUAN THẾ KỶ XXI",
    "11.txt": "DANH TỪ THIỀN HỌC (CHÚ GIẢI)",
    "12.txt": "CỘI NGUỒN TRUYỀN THỪA · THIỀN THẤT KHAI THỊ LỤC",
    "13.txt": "DUY LỰC NGỮ LỤC",
    "14.txt": "DUY LỰC NGỮ LỤC",
    "15.txt": "LƯỢC GIẢNG KINH LĂNG NGHIÊM",
    "16.txt": "ĐẠI THỪA TUYỆT ĐỐI LUẬN",
    "17.txt": "TRIỆU LUẬN LƯỢC GIẢI",
    "18.txt": "LƯỢC GIẢNG KINH KIM CANG",
    "19.txt": "KINH LĂNG NGHIÊM",
    "20.txt": "KINH LĂNG GIÀ",
    "21.txt": "ĐƯỜNG LỐI THỰC HÀNH THAM TỔ SƯ THIỀN",
    "22.txt": "LƯỢC GIẢNG TÍN TÂM MINH TỊCH NGHĨA GIẢI",
}


@dataclass
class BookPage:
    number: int
    text: str
    is_blank: bool


def book_keywords(book_id: str) -> list[str]:
    title = TITLE_OVERRIDES.get(f"{book_id}.txt", "").upper()
    parts = re.split(r"[\s·—\-/]+", title)
    kws = [p for p in parts if len(p) >= 3]
    for extra in ("NGỮ LỤC", "LUẬN", "KINH", "THIỀN", "PHẬT", "PHÁP", "THUYẾT", "GIẢNG"):
        if extra in title:
            kws.append(extra)
    return list(dict.fromkeys(kws))


def parse_running_header(line: str, keywords: list[str]) -> int | None:
    s = MARKDOWN_BOLD_RE.sub(r"\1", line.strip())
    s = re.sub(r"\s+", " ", strip_markers(s)).strip()
    if not s or len(s) > 100:
        return None
    if re.match(r"^dịch giả\s*:", s, re.I):
        return None

    marker = parse_page_marker(s)
    if marker:
        return marker[0]

    m = re.match(r"^(\d{1,4})\s+(.+)$", s)
    if m:
        num, rest = int(m.group(1)), m.group(2).upper()
        if any(k in rest for k in keywords):
            return num

    m = re.match(r"^(.+?)\s+(\d{1,4})$", s)
    if m:
        rest, num = m.group(1).upper(), int(m.group(2))
        if any(k in rest for k in keywords):
            return num
    return None


def split_pages_ocr(raw: str) -> list[tuple[int, str]]:
    parts = PAGE_MARKER_RE.split(raw)
    if len(parts) < 3:
        return []

    pages: list[tuple[int, str]] = []
    i = 1
    while i + 1 < len(parts):
        num = int(parts[i])
        body = parts[i + 1]
        pages.append((num, body))
        i += 2
    return pages


def split_pages_running(raw: str, book_id: str) -> list[tuple[int, str]]:
    keywords = book_keywords(book_id)
    if not keywords:
        return []

    buckets: dict[int, list[str]] = {}
    current: int | None = None

    for line in raw.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        stripped = line.strip()
        ocr = OCR_LINE_RE.match(stripped)
        if ocr:
            current = int(ocr.group(1))
            buckets.setdefault(current, [])
            continue

        num = parse_running_header(line, keywords)
        if num is not None:
            current = num
            buckets.setdefault(current, [])
            continue

        if current is not None:
            buckets[current].append(line)

    if not buckets:
        return []
    return sorted((n, "\n".join(lines)) for n, lines in buckets.items())


def split_pages(raw: str, book_id: str) -> tuple[list[tuple[int, str]], str]:
    ocr = split_pages_ocr(raw)
    if ocr:
        return ocr, "ocr"
    running = split_pages_running(raw, book_id)
    if running:
        return running, "running"
    return [], "none"


def clean_page_text(body: str) -> tuple[str, bool]:
    text = unicodedata.normalize("NFC", body.replace("\r\n", "\n").replace("\r", "\n"))
    text = text.strip()

    if not text or BLANK_PAGE_RE.fullmatch(text.strip()):
        return "", True
    if BLANK_PAGE_RE.search(text) and len(text) < 80:
        return "", True

    text = MARKDOWN_BOLD_RE.sub(r"\1", text)
    text = MARKDOWN_ITALIC_RE.sub(r"\1", text)
    text = text.replace("＿", "").replace("_", "")

    cleaned_lines: list[str] = []
    for line in text.split("\n"):
        line = line.rstrip()
        stripped = line.strip()

        if not stripped:
            cleaned_lines.append("")
            continue
        if ONLY_PAGE_NUM_RE.match(stripped):
            continue
        if DECORATION_RE.match(stripped):
            continue
        if BLANK_PAGE_RE.match(stripped):
            continue
        if RUNNING_TITLE_RE.match(stripped):
            continue

        if RUNNING_HEADER_RE.match(line) and len(stripped) < 90:
            letters = re.sub(
                r"[^a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
                "",
                stripped.lower(),
            )
            if len(letters) < 12:
                continue

        line = BULLET_RE.sub("", line)
        line = MULTI_SPACE_RE.sub(" ", line).strip()
        cleaned_lines.append(line)

    text = "\n".join(cleaned_lines)
    text = MULTI_BLANK_RE.sub("\n\n", text).strip()
    return text, not bool(text)


def guess_title(book_id: str, pages: list[BookPage]) -> str:
    override = TITLE_OVERRIDES.get(f"{book_id}.txt")
    if override:
        return override

    skip_prefixes = (
        "GIÁO HỘI",
        "NHÀ XUẤT BẢN",
        "THÀNH HỘI",
        "TỔ IN ẤN",
        "Dịch giả",
        "Dịch Giả",
        "Dịch và",
        "Biên soạn",
        "Tác giả",
        "Nguyên tác",
        "HT.",
        "Hòa thượng",
        "HÒA THƯỢNG",
        "THÍCH DUY LỰC",
    )
    skip_contains = ("oOo", "PL:", "PL.", "NXB", "ISBN", "Human:", "http", "ĐT:", "Email")
    candidates: list[str] = []
    for page in pages[:8]:
        if page.is_blank:
            continue
        for line in page.text.split("\n"):
            line = line.strip()
            if len(line) < 8 or len(line) > 90:
                continue
            if any(line.startswith(p) for p in skip_prefixes):
                continue
            if any(s.lower() in line.lower() for s in skip_contains):
                continue
            if line.lower().startswith(
                ("lời ", "trang ", "tái bản", "chịu trách", "hà nội", "việt dịch")
            ):
                continue
            ascii_letters = sum(1 for c in line if "A" <= c <= "Z" or "a" <= c <= "z")
            viet_letters = sum(
                1
                for c in line.lower()
                if c in "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ"
            )
            if ascii_letters > 8 and viet_letters == 0 and " " in line:
                continue
            if re.fullmatch(r"[\d\W]+", line):
                continue
            letters = re.sub(r"\s+", "", line)
            upper_ratio = sum(1 for c in letters if c.isupper()) / max(len(letters), 1)
            if upper_ratio >= 0.7 or (line[:1].isupper() and viet_letters > 0):
                candidates.append(line)
        if len(candidates) >= 4:
            break

    if not candidates:
        return "Kinh sách"

    scored = sorted(
        candidates,
        key=lambda s: (
            sum(1 for c in s if c.isupper()) / max(len(s), 1),
            len(s),
        ),
        reverse=True,
    )
    unique: list[str] = []
    for c in scored:
        if c not in unique and not any(c in u or u in c for u in unique):
            unique.append(c)
        if len(unique) >= 2:
            break
    if len(unique) >= 2 and all(len(u) <= 45 for u in unique[:2]):
        return f"{unique[0]} — {unique[1]}"
    return unique[0]


def format_readable(pages: list[BookPage], title: str) -> str:
    blocks = [f"# {title}", ""]
    for page in pages:
        if page.is_blank:
            continue
        blocks.append(f"{'═' * 12} Trang {page.number} {'═' * 12}")
        blocks.append("")
        blocks.append(page.text)
        blocks.append("")
    return "\n".join(blocks).rstrip() + "\n"


def clean_output_dir(out_root: Path) -> None:
    if out_root.exists():
        shutil.rmtree(out_root)
    out_root.mkdir(parents=True, exist_ok=True)


def process_book(src: Path, out_root: Path) -> dict | None:
    raw = src.read_text(encoding="utf-8")
    book_id = src.stem
    split, mode = split_pages(raw, book_id)
    if not split:
        return {
            "id": book_id,
            "source": src.name,
            "status": "skipped_no_markers",
            "pageCount": 0,
            "title": None,
            "message": "No page markers found",
        }

    by_num: dict[int, BookPage] = {}
    for num, body in split:
        text, is_blank = clean_page_text(body)
        if num in by_num and not is_blank:
            prev = by_num[num]
            if not prev.is_blank:
                text = (prev.text + "\n\n" + text).strip()
            is_blank = not bool(text)
        by_num[num] = BookPage(number=num, text=text, is_blank=is_blank)

    max_num = max(by_num)
    ordered: list[BookPage] = []
    blank_count = 0
    for n in range(1, max_num + 1):
        if n in by_num:
            page = by_num[n]
        else:
            page = BookPage(number=n, text="", is_blank=True)
        ordered.append(page)
        if page.is_blank:
            blank_count += 1

    title = guess_title(book_id, ordered)
    book_dir = out_root / book_id
    pages_dir = book_dir / "pages"
    if book_dir.exists():
        shutil.rmtree(book_dir)
    pages_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    for page in ordered:
        if page.is_blank:
            continue
        path = pages_dir / f"{page.number:04d}.txt"
        path.write_text(page.text + "\n", encoding="utf-8")
        written += 1

    (book_dir / "readable.txt").write_text(format_readable(ordered, title), encoding="utf-8")

    combined_parts = []
    for page in ordered:
        if page.is_blank:
            continue
        combined_parts.append(f"--- {page.number} ---\n{page.text}")
    (book_dir / "book.txt").write_text("\n\n".join(combined_parts) + "\n", encoding="utf-8")

    meta = {
        "id": book_id,
        "source": src.name,
        "title": title,
        "author": "Hòa thượng Thích Duy Lực",
        "pageCount": max_num,
        "contentPages": written,
        "blankPages": blank_count,
        "splitMode": mode,
        "status": "ready",
        "format": "per-page-text",
        "pagesDir": "pages/",
    }
    (book_dir / "book.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return meta


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Copy text/*.txt into text/doc-chu/ and normalize for Đọc chữ "
        "(never modifies originals used by embed)."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--source-copy", type=Path, default=DEFAULT_SOURCE_COPY)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--ids", nargs="*", help="Only process these book ids")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Delete all generated books before rebuild",
    )
    args = parser.parse_args()

    input_root = args.input.resolve()
    if args.output.resolve() == input_root or args.source_copy.resolve() == input_root:
        raise SystemExit("Refusing to use text/ as output — originals must stay untouched.")

    if args.clean:
        print(f"🧹 Cleaning {args.output} and {args.source_copy}")
        clean_output_dir(args.output)
        clean_output_dir(args.source_copy)
    else:
        args.source_copy.mkdir(parents=True, exist_ok=True)
        args.output.mkdir(parents=True, exist_ok=True)

    sources = sorted(p for p in args.input.glob("*.txt") if p.parent.resolve() == input_root)
    if args.ids:
        wanted = set(args.ids)
        sources = [p for p in sources if p.stem in wanted]

    catalog: list[dict] = []
    ready = 0
    skipped = 0

    for src in sources:
        print(f"→ {src.name}")
        copy_path = args.source_copy / src.name
        shutil.copy2(src, copy_path)
        meta = process_book(copy_path, args.output)
        if meta is None:
            continue
        catalog.append(meta)
        if meta.get("status") == "ready":
            ready += 1
            print(
                f"  ✓ {meta['title'][:55]} — trang 1–{meta['pageCount']} "
                f"({meta['contentPages']} có chữ, {meta['blankPages']} trống, {meta['splitMode']})"
            )
        else:
            skipped += 1
            print(f"  ⏭ skipped ({meta.get('message')})")

    catalog.sort(key=lambda m: int(m["id"]) if str(m["id"]).isdigit() else m["id"])
    (args.output / "catalog.json").write_text(
        json.dumps(
            {
                "version": 2,
                "labelBanGoc": "Bản gốc",
                "labelDocChu": "Đọc chữ",
                "sourceNote": "Originals remain in text/*.txt for embed; this folder is Đọc chữ only.",
                "books": catalog,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"\nDone: {ready} ready, {skipped} skipped")
    print(f"  originals (embed): {args.input}")
    print(f"  copies:            {args.source_copy}")
    print(f"  cleaned books:     {args.output}")


if __name__ == "__main__":
    main()
