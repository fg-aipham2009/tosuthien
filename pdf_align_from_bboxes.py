"""
Align scanned PDF pages using per-page vision OCR bounding boxes.

Why: geometric deskew alone cannot fix left/right shift — each scan page sits
differently on the scanner. Vision models detect the text block per page; we
crop to that block and center it on a uniform canvas (like born-digital books).

Pipeline:
1) Render page upright (rotation baked via pixmap)
2) OCR lines with bbox JSON (reuse pdf_searchable_gpt cache/API)
3) Compute envelope of all line boxes
4) Crop + center on uniform page size
"""

from __future__ import annotations

import argparse
import io
import json
from pathlib import Path
from statistics import median

import fitz
import numpy as np
from PIL import Image
from tqdm import tqdm

from pdf_searchable_gpt import build_searchable_pdf, ocr_page_lines, parse_json_lines

BASE_DIR = Path(__file__).resolve().parent


def render_upright_rgb(page: fitz.Page, zoom: float) -> np.ndarray:
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    return np.array(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))


def envelope_from_lines(lines: list[dict], margin_norm: float = 8.0) -> tuple[float, float, float, float]:
    if not lines:
        return 0.0, 0.0, 1000.0, 1000.0
    x0 = min(float(l["x0"]) for l in lines) - margin_norm
    y0 = min(float(l["y0"]) for l in lines) - margin_norm
    x1 = max(float(l["x1"]) for l in lines) + margin_norm
    y1 = max(float(l["y1"]) for l in lines) + margin_norm
    return (
        max(0.0, x0),
        max(0.0, y0),
        min(1000.0, x1),
        min(1000.0, y1),
    )


def norm_box_to_px(
    box: tuple[float, float, float, float],
    img_w: int,
    img_h: int,
) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = box
    return (
        int(x0 / 1000.0 * img_w),
        int(y0 / 1000.0 * img_h),
        int(x1 / 1000.0 * img_w),
        int(y1 / 1000.0 * img_h),
    )


def crop_rgb(rgb: np.ndarray, px_box: tuple[int, int, int, int]) -> np.ndarray:
    x0, y0, x1, y1 = px_box
    h, w = rgb.shape[:2]
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(w, x1), min(h, y1)
    if x1 <= x0 or y1 <= y0:
        return rgb
    return rgb[y0:y1, x0:x1]


def center_on_canvas(crop: np.ndarray, canvas_w: int, canvas_h: int) -> np.ndarray:
    canvas = np.full((canvas_h, canvas_w, 3), 255, dtype=np.uint8)
    ch, cw = crop.shape[:2]
    x0 = max(0, (canvas_w - cw) // 2)
    y0 = max(0, (canvas_h - ch) // 2)
    # Scale down if crop exceeds canvas.
    if cw > canvas_w or ch > canvas_h:
        scale = min(canvas_w / cw, canvas_h / ch)
        new_w = max(1, int(cw * scale))
        new_h = max(1, int(ch * scale))
        crop = np.array(
            Image.fromarray(crop).resize((new_w, new_h), resample=Image.Resampling.LANCZOS)
        )
        ch, cw = crop.shape[:2]
        x0 = (canvas_w - cw) // 2
        y0 = (canvas_h - ch) // 2
    canvas[y0 : y0 + ch, x0 : x0 + cw] = crop
    return canvas


def load_or_ocr_lines(
    page: fitz.Page,
    page_index: int,
    cache_dir: Path,
    model: str,
    image_scale: float,
) -> list[dict]:
    cache_file = cache_dir / f"page_{page_index:04d}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    mat = fitz.Matrix(image_scale, image_scale)
    pix = page.get_pixmap(matrix=mat)
    png = pix.tobytes("png")
    if len(png) < 2500:
        lines: list[dict] = []
    else:
        lines = ocr_page_lines(png, model)
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(lines, ensure_ascii=False, indent=2), encoding="utf-8")
    return lines


def calibrate_canvas_px(
    src: fitz.Document,
    indices: list[int],
    cache_dir: Path,
    model: str,
    zoom: float,
    image_scale: float,
    margin_norm: float,
) -> tuple[int, int]:
    widths: list[int] = []
    heights: list[int] = []
    for i in indices:
        rgb = render_upright_rgb(src[i], zoom)
        lines = load_or_ocr_lines(src[i], i, cache_dir, model, image_scale)
        box = envelope_from_lines(lines, margin_norm)
        x0, y0, x1, y1 = norm_box_to_px(box, rgb.shape[1], rgb.shape[0])
        widths.append(max(1, x1 - x0))
        heights.append(max(1, y1 - y0))
    return int(median(widths)), int(median(heights))


def align_pdf_from_bboxes(
    source: Path,
    output: Path,
    *,
    cache_dir: Path,
    model: str,
    zoom: float = 2.0,
    image_scale: float = 1.5,
    margin_norm: float = 8.0,
    calibrate_pages: int = 20,
    start_page: int = 0,
    end_page: int | None = None,
    max_pages: int | None = None,
    add_searchable_layer: bool = False,
) -> None:
    src = fitz.open(source)
    last = src.page_count if end_page is None else min(end_page + 1, src.page_count)
    indices = list(range(start_page, last))
    if max_pages is not None:
        indices = indices[:max_pages]
    if not indices:
        raise SystemExit("No pages selected")

    calib = indices[: min(len(indices), calibrate_pages)]
    canvas_w_px, canvas_h_px = calibrate_canvas_px(
        src, calib, cache_dir, model, zoom, image_scale, margin_norm
    )
    page_w_pt = canvas_w_px / zoom
    page_h_pt = canvas_h_px / zoom

    out = fitz.open()
    for i in tqdm(indices, desc="Align"):
        rgb = render_upright_rgb(src[i], zoom)
        lines = load_or_ocr_lines(src[i], i, cache_dir, model, image_scale)
        box = envelope_from_lines(lines, margin_norm)
        px_box = norm_box_to_px(box, rgb.shape[1], rgb.shape[0])
        cropped = crop_rgb(rgb, px_box)
        canvas = center_on_canvas(cropped, canvas_w_px, canvas_h_px)

        page = out.new_page(width=page_w_pt, height=page_h_pt)
        img = Image.fromarray(canvas)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=92, optimize=True)
        page.insert_image(page.rect, stream=buf.getvalue())

        if add_searchable_layer and lines:
            from pdf_searchable_gpt import add_invisible_lines

            add_invisible_lines(page, lines)

    output.parent.mkdir(parents=True, exist_ok=True)
    out.save(str(output), garbage=4, deflate=True)
    out.close()
    src.close()
    print(
        f"Saved {len(indices)} pages -> {output} "
        f"({page_w_pt:.1f}x{page_h_pt:.1f} pt, bbox-aligned)"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Align scan PDF using per-page vision OCR bounding boxes"
    )
    parser.add_argument("book_id", help="e.g. 15")
    parser.add_argument("--model", default="gpt-5.6-sol")
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--zoom", type=float, default=2.0)
    parser.add_argument("--margin-norm", type=float, default=8.0)
    parser.add_argument("--calibrate-pages", type=int, default=20)
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=None)
    parser.add_argument("--max-pages", type=int, default=None)
    parser.add_argument(
        "--searchable",
        action="store_true",
        help="Also add invisible text layer from cached bboxes",
    )
    args = parser.parse_args()

    book_id = args.book_id
    source = args.source or (BASE_DIR / "data" / "pdf" / f"{book_id}.pdf")
    output = args.output or (BASE_DIR / "data" / "pdf" / f"{book_id}-aligned-gpt.pdf")
    cache = args.cache_dir or (BASE_DIR / "text" / f".searchable-{book_id}")

    align_pdf_from_bboxes(
        source,
        output,
        cache_dir=cache,
        model=args.model,
        zoom=args.zoom,
        margin_norm=args.margin_norm,
        calibrate_pages=args.calibrate_pages,
        start_page=args.start_page,
        end_page=args.end_page,
        max_pages=args.max_pages,
        add_searchable_layer=args.searchable,
    )


if __name__ == "__main__":
    main()
