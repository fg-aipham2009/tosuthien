"""
Normalize scanned book PDFs to upright, deskewed, uniform pages.

Pipeline per page:
1. Render with rotation baked in (PyMuPDF pixmap)
2. Optional auto-deskew (projection profile)
3. Crop to content bounds + margin
4. Center on a uniform white canvas (same size for every page)

Use this before OCR / searchable-PDF so pages look like born-digital books (19, 20).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import fitz
import numpy as np
from PIL import Image
from tqdm import tqdm

BASE_DIR = Path(__file__).resolve().parent


def render_page_rgb(page: fitz.Page, zoom: float) -> np.ndarray:
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    return np.array(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))


def estimate_deskew_angle(gray: np.ndarray, max_angle: float = 3.0, step: float = 0.25) -> float:
    """Return small correction angle (degrees, counter-clockwise)."""
    thresh = gray < np.percentile(gray, 35)
    if thresh.mean() < 0.01:
        return 0.0

    img = Image.fromarray((thresh.astype(np.uint8) * 255))
    best_angle, best_score = 0.0, -1.0
    angle = -max_angle
    while angle <= max_angle + 1e-9:
        rot = np.array(img.rotate(angle, expand=False, resample=Image.Resampling.BILINEAR, fillcolor=0)) < 128
        score = rot.sum(axis=1).astype(np.float64).var()
        if score > best_score:
            best_score, best_angle = score, angle
        angle += step

    if abs(best_angle) < 0.2:
        return 0.0
    return best_angle


def content_bbox(rgb: np.ndarray, white_threshold: int = 245) -> tuple[int, int, int, int] | None:
    gray = rgb.mean(axis=2)
    mask = gray < white_threshold
    if not mask.any():
        return None
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def crop_with_margin(
    rgb: np.ndarray,
    bbox: tuple[int, int, int, int],
    margin_px: int,
) -> np.ndarray:
    x0, y0, x1, y1 = bbox
    h, w = rgb.shape[:2]
    x0 = max(0, x0 - margin_px)
    y0 = max(0, y0 - margin_px)
    x1 = min(w, x1 + margin_px)
    y1 = min(h, y1 + margin_px)
    return rgb[y0:y1, x0:x1]


def process_page_array(
    rgb: np.ndarray,
    *,
    deskew: bool,
    margin_px: int,
) -> np.ndarray:
    gray = rgb.mean(axis=2).astype(np.uint8)
    if deskew:
        angle = estimate_deskew_angle(gray)
        if abs(angle) >= 0.2:
            rgb = np.array(
                Image.fromarray(rgb).rotate(
                    angle,
                    expand=True,
                    resample=Image.Resampling.BICUBIC,
                    fillcolor=(255, 255, 255),
                )
            )

    bbox = content_bbox(rgb)
    if bbox is None:
        return rgb
    return crop_with_margin(rgb, bbox, margin_px)


def measure_canvas_px(
    src: fitz.Document,
    indices: list[int],
    *,
    zoom: float,
    deskew: bool,
    margin_px: int,
) -> tuple[int, int]:
    max_w, max_h = 0, 0
    for i in indices:
        rgb = render_page_rgb(src[i], zoom)
        cropped = process_page_array(rgb, deskew=deskew, margin_px=margin_px)
        max_w = max(max_w, cropped.shape[1])
        max_h = max(max_h, cropped.shape[0])
    return max_w, max_h


def center_on_canvas(rgb: np.ndarray, canvas_w: int, canvas_h: int) -> np.ndarray:
    canvas = np.full((canvas_h, canvas_w, 3), 255, dtype=np.uint8)
    h, w = rgb.shape[:2]
    x0 = max(0, (canvas_w - w) // 2)
    y0 = max(0, (canvas_h - h) // 2)
    canvas[y0 : y0 + h, x0 : x0 + w] = rgb
    return canvas


def normalize_pdf(
    source: Path,
    output: Path,
    *,
    zoom: float = 2.0,
    deskew: bool = True,
    margin_px: int = 12,
    target_width_pt: float | None = None,
    target_height_pt: float | None = None,
    start_page: int = 0,
    end_page: int | None = None,
    max_pages: int | None = None,
) -> None:
    src = fitz.open(source)
    last = src.page_count if end_page is None else min(end_page + 1, src.page_count)
    indices = list(range(start_page, last))
    if max_pages is not None:
        indices = indices[:max_pages]
    if not indices:
        raise SystemExit("No pages selected")

    canvas_w_px, canvas_h_px = measure_canvas_px(
        src, indices, zoom=zoom, deskew=deskew, margin_px=margin_px
    )

    if target_width_pt and target_height_pt:
        page_w_pt, page_h_pt = target_width_pt, target_height_pt
    else:
        page_w_pt = canvas_w_px / zoom
        page_h_pt = canvas_h_px / zoom

    out = fitz.open()
    for i in tqdm(indices, desc="Normalize"):
        rgb = render_page_rgb(src[i], zoom)
        cropped = process_page_array(rgb, deskew=deskew, margin_px=margin_px)
        canvas = center_on_canvas(cropped, canvas_w_px, canvas_h_px)

        page = out.new_page(width=page_w_pt, height=page_h_pt)
        img = Image.fromarray(canvas)
        buf = __import__("io").BytesIO()
        img.save(buf, format="JPEG", quality=92, optimize=True)
        page.insert_image(page.rect, stream=buf.getvalue())

    output.parent.mkdir(parents=True, exist_ok=True)
    out.save(str(output), garbage=4, deflate=True)
    out.close()
    src.close()
    print(
        f"Saved {len(indices)} pages -> {output} "
        f"({page_w_pt:.1f}x{page_h_pt:.1f} pt, rotation=0)"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize scanned PDF pages")
    parser.add_argument("input_pdf", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    parser.add_argument("--zoom", type=float, default=2.0)
    parser.add_argument("--no-deskew", action="store_true")
    parser.add_argument("--margin-px", type=int, default=12)
    parser.add_argument(
        "--target-size",
        type=float,
        nargs=2,
        metavar=("WIDTH_PT", "HEIGHT_PT"),
        help="Force page size in points, e.g. 470 640 like quyen 19",
    )
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=None)
    parser.add_argument("--max-pages", type=int, default=None)
    args = parser.parse_args()

    tw = th = None
    if args.target_size:
        tw, th = args.target_size

    normalize_pdf(
        args.input_pdf,
        args.output,
        zoom=args.zoom,
        deskew=not args.no_deskew,
        margin_px=args.margin_px,
        target_width_pt=tw,
        target_height_pt=th,
        start_page=args.start_page,
        end_page=args.end_page,
        max_pages=args.max_pages,
    )


if __name__ == "__main__":
    main()
