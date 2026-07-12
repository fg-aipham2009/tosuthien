"""
Flatten scanned PDF page rotation into upright portrait pages.

Fixes:
- PDF 15: mediabox landscape + rotation 90/270 -> portrait, rotation=0
- PDF 5/1/2: alternating rotation 0/180 -> all pages visually upright

Renders each page to pixmap (rotation baked in) and rebuilds a clean PDF.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import fitz
from tqdm import tqdm

BASE_DIR = Path(__file__).resolve().parent


def flatten_pdf(
    source: Path,
    output: Path,
    *,
    zoom: float = 2.0,
    start_page: int = 0,
    end_page: int | None = None,
    max_pages: int | None = None,
) -> None:
    src = fitz.open(source)
    out = fitz.open()
    mat = fitz.Matrix(zoom, zoom)
    last = src.page_count if end_page is None else min(end_page + 1, src.page_count)
    indices = list(range(start_page, last))
    if max_pages is not None:
        indices = indices[:max_pages]

    for i in tqdm(indices, desc="Flatten"):
        page = src[i]
        pix = page.get_pixmap(matrix=mat, alpha=False)
        w = pix.width / zoom
        h = pix.height / zoom
        new_page = out.new_page(width=w, height=h)
        new_page.insert_image(new_page.rect, pixmap=pix)

    output.parent.mkdir(parents=True, exist_ok=True)
    out.save(str(output), garbage=4, deflate=True)
    out.close()
    src.close()
    print(f"Saved {len(indices)} pages -> {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Flatten PDF rotation to upright portrait")
    parser.add_argument("input_pdf", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    parser.add_argument("--zoom", type=float, default=2.0, help="Render scale (default 2)")
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=None)
    parser.add_argument("--max-pages", type=int, default=None)
    args = parser.parse_args()

    flatten_pdf(
        args.input_pdf,
        args.output,
        zoom=args.zoom,
        start_page=args.start_page,
        end_page=args.end_page,
        max_pages=args.max_pages,
    )


if __name__ == "__main__":
    main()
