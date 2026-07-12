#!/usr/bin/env python3
"""
Quick scan of text/*.txt for the Đọc chữ pipeline.

Read-only, no file writes — finishes in seconds.

Usage:
  python3 analyze_book_text.py
  python3 analyze_book_text.py --ids 15 22
  python3 analyze_book_text.py --json
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = BASE_DIR / "text"
DEFAULT_DOC_CHU = BASE_DIR / "text" / "doc-chu" / "books"

PAGE_MARKER_RE = re.compile(r"^---\s*(\d+)\s*---\s*$", re.MULTILINE)


def scan_file(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8", errors="replace")
    size_kb = path.stat().st_size / 1024
    lines = raw.count("\n") + (1 if raw and not raw.endswith("\n") else 0)
    chars = len(raw)

    nums = [int(m) for m in PAGE_MARKER_RE.findall(raw)]
    if not nums:
        return {
            "id": path.stem,
            "file": path.name,
            "size_kb": round(size_kb, 1),
            "lines": lines,
            "chars": chars,
            "status": "no_markers",
            "page_count": 0,
            "first_page": None,
            "last_page": None,
            "gaps": 0,
            "dup_pages": 0,
            "doc_chu_ready": _doc_chu_status(path.stem),
            "note": "Thiếu marker --- N --- → cần OCR lại bằng pdf_to_text.py",
        }

    first, last = nums[0], nums[-1]
    unique = sorted(set(nums))
    gaps = sum(1 for a, b in zip(unique, unique[1:]) if b - a > 1)
    dup = len(nums) - len(unique)

    # Rough title guess: first non-empty line after page 1 marker
    title_hint = _guess_title_hint(raw)

    return {
        "id": path.stem,
        "file": path.name,
        "size_kb": round(size_kb, 1),
        "lines": lines,
        "chars": chars,
        "status": "ok",
        "page_count": last,
        "markers": len(nums),
        "unique_pages": len(unique),
        "first_page": first,
        "last_page": last,
        "gaps": gaps,
        "dup_pages": dup,
        "title_hint": title_hint,
        "doc_chu_ready": _doc_chu_status(path.stem),
        "note": _note(gaps, dup, first),
    }


def _doc_chu_status(book_id: str) -> str:
    book_json = DEFAULT_DOC_CHU / book_id / "book.json"
    pages_dir = DEFAULT_DOC_CHU / book_id / "pages"
    if book_json.is_file():
        try:
            meta = json.loads(book_json.read_text(encoding="utf-8"))
            if meta.get("status") == "ready":
                return f"ready ({meta.get('pageCount', '?')} trang)"
        except json.JSONDecodeError:
            pass
    if pages_dir.is_dir():
        n = len(list(pages_dir.glob("*.txt")))
        return f"partial ({n} files)" if n else "empty"
    return "chưa có"


def _guess_title_hint(raw: str) -> str | None:
    parts = PAGE_MARKER_RE.split(raw, maxsplit=2)
    if len(parts) < 3:
        return None
    body = parts[2][:2000]
    for line in body.splitlines():
        line = line.strip()
        if 10 <= len(line) <= 80 and not line.startswith(("---", "GIÁO HỘI", "NHÀ XUẤT")):
            return line[:72]
    return None


def _note(gaps: int, dup: int, first: int) -> str:
    bits = []
    if first != 1:
        bits.append(f"bắt đầu trang {first}")
    if gaps:
        bits.append(f"{gaps} khoảng trống số trang")
    if dup:
        bits.append(f"{dup} trang trùng marker")
    return "; ".join(bits) if bits else "OK"


def print_table(rows: list[dict]) -> None:
    ok = [r for r in rows if r["status"] == "ok"]
    bad = [r for r in rows if r["status"] != "ok"]

    print(f"\n{'ID':>4}  {'KB':>7}  {'Trang':>6}  {'Đọc chữ':<18}  Ghi chú")
    print("-" * 72)
    for r in sorted(rows, key=lambda x: int(x["id"]) if x["id"].isdigit() else x["id"]):
        pages = str(r["page_count"]) if r["status"] == "ok" else "—"
        note = r.get("title_hint") or r.get("note", "")
        if len(note) > 38:
            note = note[:35] + "..."
        print(
            f"{r['id']:>4}  {r['size_kb']:>7.1f}  {pages:>6}  "
            f"{r['doc_chu_ready']:<18}  {note}"
        )

    print(f"\nTổng: {len(rows)} file — {len(ok)} có marker, {len(bad)} thiếu marker")
    ready = sum(1 for r in ok if str(r["doc_chu_ready"]).startswith("ready"))
    print(f"Đọc chữ đã build: {ready}/{len(ok)}")

    if bad:
        print("\nThiếu marker (không normalize được):")
        print("  " + ", ".join(r["id"] for r in bad))

    need_build = [r["id"] for r in ok if not str(r["doc_chu_ready"]).startswith("ready")]
    if need_build:
        print("\nCó marker nhưng chưa build Đọc chữ:")
        print("  " + ", ".join(need_build))
        print("  → python3 normalize_book_text.py --ids " + " ".join(need_build[:8])
              + (" ..." if len(need_build) > 8 else ""))


def main() -> None:
    parser = argparse.ArgumentParser(description="Fast read-only scan of text/*.txt")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--ids", nargs="*", help="Only these book ids")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of table")
    args = parser.parse_args()

    root = args.input.resolve()
    files = sorted(p for p in root.glob("*.txt") if p.parent.resolve() == root)
    if args.ids:
        wanted = set(args.ids)
        files = [p for p in files if p.stem in wanted]

    if not files:
        raise SystemExit(f"No *.txt in {root}")

    rows = [scan_file(p) for p in files]

    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        print(f"Scan: {root} ({len(files)} files)")
        print_table(rows)


if __name__ == "__main__":
    main()
