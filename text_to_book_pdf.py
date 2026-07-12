"""
Build a line-faithful PDF from per-page OCR text (one OCR page -> one PDF page).

Preserves line breaks and leading/trailing spaces (monospace font).
Intended for scanned books converted via pdf_to_text.py page cache.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import fitz

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_FONT = "/System/Library/Fonts/Supplemental/Courier New.ttf"


def page_files(pages_dir: Path) -> list[Path]:
    return sorted(pages_dir.glob("page_*.txt"))


def page_index(path: Path) -> int:
    m = re.search(r"page_(\d+)\.txt$", path.name)
    if not m:
        raise ValueError(f"Unexpected page file name: {path.name}")
    return int(m.group(1))


def layout_for_page(
    line_count: int,
    page_height: float,
    *,
    top_margin: float,
    bottom_margin: float,
    default_line_height: float,
    font_size: float,
) -> tuple[float, float]:
    usable = page_height - top_margin - bottom_margin
    line_height = default_line_height
    if line_count > 0 and line_count * line_height > usable:
        line_height = max(font_size * 1.15, usable / line_count)
    return line_height, top_margin + font_size


def build_pdf(
    pages_dir: Path,
    source_pdf: Path,
    output_pdf: Path,
    *,
    max_pages: int | None = None,
    start_page: int = 0,
    end_page: int | None = None,
    font_path: str = DEFAULT_FONT,
    font_size: float = 10.5,
    left_margin: float = 34.0,
    top_margin: float = 38.0,
    bottom_margin: float = 34.0,
    line_height: float = 12.8,
) -> None:
    if not pages_dir.is_dir():
        raise SystemExit(f"Missing pages dir: {pages_dir}")
    if not source_pdf.is_file():
        raise SystemExit(f"Missing source PDF: {source_pdf}")

    files = page_files(pages_dir)
    if start_page or end_page is not None:
        files = [
            p
            for p in files
            if start_page <= page_index(p) <= (end_page if end_page is not None else 10**9)
        ]
    if max_pages is not None:
        files = files[:max_pages]
    if not files:
        raise SystemExit(f"No page files in {pages_dir}")

    with fitz.open(source_pdf) as src:
        page_rect = src[0].rect

    font_path = str(font_path)
    font = fitz.Font(fontfile=font_path)
    out = fitz.open()

    for page_path in files:
        text = page_path.read_text(encoding="utf-8")
        lines = text.splitlines()
        page = out.new_page(width=page_rect.width, height=page_rect.height)
        lh, y = layout_for_page(
            len(lines),
            page_rect.height,
            top_margin=top_margin,
            bottom_margin=bottom_margin,
            default_line_height=line_height,
            font_size=font_size,
        )

        writer = fitz.TextWriter(page.rect)
        for line in lines:
            if y > page_rect.height - bottom_margin:
                break
            writer.append((left_margin, y), line, font=font, fontsize=font_size)
            y += lh
        writer.write_text(page)

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    out.save(str(output_pdf))
    out.close()
    print(f"Wrote {len(files)} pages -> {output_pdf}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Per-page OCR text -> line-faithful PDF")
    parser.add_argument("book_id", help="Book id, e.g. 15")
    parser.add_argument(
        "--pages-dir",
        type=Path,
        help="Directory with page_XXXX.txt (default: text/.ocr-{id})",
    )
    parser.add_argument(
        "--source-pdf",
        type=Path,
        help="Scan PDF for page size (default: data/pdf/{id}.pdf)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output PDF (default: data/pdf/{id}-book-line.pdf)",
    )
    parser.add_argument("--max-pages", type=int, default=None)
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=None)
    parser.add_argument("--font-size", type=float, default=10.5)
    args = parser.parse_args()

    book_id = args.book_id
    pages_dir = args.pages_dir or (BASE_DIR / "text" / f".ocr-{book_id}")
    source_pdf = args.source_pdf or (BASE_DIR / "data" / "pdf" / f"{book_id}.pdf")
    output_pdf = args.output or (BASE_DIR / "data" / "pdf" / f"{book_id}-book-line.pdf")

    build_pdf(
        pages_dir,
        source_pdf,
        output_pdf,
        max_pages=args.max_pages,
        start_page=args.start_page,
        end_page=args.end_page,
        font_size=args.font_size,
    )


if __name__ == "__main__":
    main()
