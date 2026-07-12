"""
Straighten scanned book PDF pages.

Fixes for quyen 15-style scans:
1) Bake PDF rotation via pixmap render
2) Flip 180° on pages with rotation=270 (alternating upside-down scans)
3) Deskew via OCR line-bbox median angle + projection refine
4) Center content on uniform page canvas (same size every page)
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import math
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from statistics import median

import fitz
import numpy as np
from dotenv import load_dotenv
from PIL import Image
from tqdm import tqdm

from pdf_searchable_gpt import ocr_page_lines

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

HHTECH_BASE_URL = os.environ.get("HHTECH_BASE_URL", "https://hhtechapi.com/v1").rstrip("/")
HHTECH_API_KEY = os.environ.get("HHTECH_API_KEY", "")
DEFAULT_MODEL = "gpt-5.6-sol"


def parse_angle(raw: str) -> float:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    data = json.loads(text[start : end + 1])
    return max(-8.0, min(8.0, float(data.get("rotate_clockwise_deg", 0))))


def ocr_with_retry(image_bytes: bytes, model: str, retries: int = 3) -> list[dict]:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            return ocr_page_lines(image_bytes, model)
        except Exception as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise last_err or RuntimeError("OCR failed")


def angle_from_line_bboxes(lines: list[dict], min_width: float = 220.0) -> float | None:
    angles: list[float] = []
    for line in lines:
        x0, y0 = float(line["x0"]), float(line["y0"])
        x1, y1 = float(line["x1"]), float(line["y1"])
        if x1 - x0 < min_width:
            continue
        dy, dx = y1 - y0, x1 - x0
        if abs(dx) < 1:
            continue
        angles.append(math.degrees(math.atan2(dy, dx)))
    if len(angles) < 3:
        return None
    med = median(angles)
    filtered = [a for a in angles if abs(a - med) <= 2.5]
    if len(filtered) < 3:
        filtered = angles
    return float(median(filtered))


def envelope_norm(lines: list[dict], margin: float = 6.0) -> tuple[float, float, float, float]:
    if not lines:
        return 0.0, 0.0, 1000.0, 1000.0
    x0 = min(float(l["x0"]) for l in lines) - margin
    y0 = min(float(l["y0"]) for l in lines) - margin
    x1 = max(float(l["x1"]) for l in lines) + margin
    y1 = max(float(l["y1"]) for l in lines) + margin
    return max(0, x0), max(0, y0), min(1000, x1), min(1000, y1)


def flip_envelope(env: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    x0, y0, x1, y1 = env
    return (1000.0 - x1, 1000.0 - y1, 1000.0 - x0, 1000.0 - y0)


def needs_flip_180(lines: list[dict], pdf_rotation: int) -> bool:
    if pdf_rotation == 270:
        return True
    if pdf_rotation == 90:
        return False
    # Fallback: page number should be on the right in header band.
    top = [l for l in lines if float(l["y0"]) < 90]
    left_num = any(float(l["x0"]) < 160 and str(l["text"]).strip().isdigit() for l in top)
    right_num = any(float(l["x0"]) > 760 and str(l["text"]).strip().isdigit() for l in top)
    if left_num and not right_num:
        return True
    return False


def projection_score(gray: np.ndarray, rotate_clockwise_deg: float) -> float:
    if abs(rotate_clockwise_deg) >= 0.01:
        gray = np.array(
            Image.fromarray(gray).rotate(
                -rotate_clockwise_deg, expand=False, resample=Image.Resampling.BILINEAR, fillcolor=255
            )
        )
    h, w = gray.shape
    roi = gray[int(h * 0.12) : int(h * 0.88), int(w * 0.08) : int(w * 0.92)]
    mask = roi < np.percentile(roi, 38)
    return float(mask.sum(axis=1).astype(np.float64).var())


def refine_angle(gray: np.ndarray, rough: float, span: float = 2.0, step: float = 0.05) -> float:
    best_angle, best_score = rough, -1.0
    a = rough - span
    while a <= rough + span + 1e-9:
        score = projection_score(gray, a)
        if score > best_score:
            best_score, best_angle = score, a
        a += step
    return best_angle


def load_or_ocr_lines(
    page: fitz.Page,
    page_index: int,
    bbox_cache: Path,
    model: str,
    image_scale: float,
) -> list[dict]:
    cache_file = bbox_cache / f"page_{page_index:04d}.json"
    if cache_file.exists():
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    pix = page.get_pixmap(matrix=fitz.Matrix(image_scale, image_scale))
    png = pix.tobytes("png")
    lines = [] if len(png) < 2500 else ocr_with_retry(png, model)
    bbox_cache.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(lines, ensure_ascii=False, indent=2), encoding="utf-8")
    return lines


def rotate_image(rgb: np.ndarray, deg_clockwise: float, expand: bool = False) -> np.ndarray:
    if abs(deg_clockwise) < 0.01:
        return rgb
    return np.array(
        Image.fromarray(rgb).rotate(
            -deg_clockwise,
            expand=expand,
            resample=Image.Resampling.BICUBIC,
            fillcolor=(255, 255, 255),
        )
    )


def center_on_canvas(
    rgb: np.ndarray,
    env_norm: tuple[float, float, float, float],
    canvas_w: int,
    canvas_h: int,
) -> np.ndarray:
    """Shift image so bbox envelope center aligns to canvas center."""
    h, w = rgb.shape[:2]
    x0, y0, x1, y1 = env_norm
    px0, py0 = int(x0 / 1000 * w), int(y0 / 1000 * h)
    px1, py1 = int(x1 / 1000 * w), int(y1 / 1000 * h)
    cx, cy = (px0 + px1) / 2, (py0 + py1) / 2

    canvas = np.full((canvas_h, canvas_w, 3), 255, dtype=np.uint8)
    # Place image so content center hits canvas center.
    dst_x = int(round(canvas_w / 2 - cx))
    dst_y = int(round(canvas_h / 2 - cy))

    src_x0 = max(0, -dst_x)
    src_y0 = max(0, -dst_y)
    dst_x0 = max(0, dst_x)
    dst_y0 = max(0, dst_y)

    copy_w = min(w - src_x0, canvas_w - dst_x0)
    copy_h = min(h - src_y0, canvas_h - dst_y0)
    if copy_w > 0 and copy_h > 0:
        canvas[dst_y0 : dst_y0 + copy_h, dst_x0 : dst_x0 + copy_w] = rgb[
            src_y0 : src_y0 + copy_h, src_x0 : src_x0 + copy_w
        ]
    return canvas


def straighten_pdf(
    source: Path,
    output: Path,
    *,
    bbox_cache: Path,
    straight_cache: Path,
    model: str,
    zoom: float = 2.0,
    image_scale: float = 1.5,
    canvas_w_px: int | None = None,
    canvas_h_px: int | None = None,
    start_page: int = 0,
    end_page: int | None = None,
    max_pages: int | None = None,
    force: bool = False,
) -> None:
    src = fitz.open(source)
    last = src.page_count if end_page is None else min(end_page + 1, src.page_count)
    indices = list(range(start_page, last))
    if max_pages is not None:
        indices = indices[:max_pages]

    # Default uniform canvas from first page render size at zoom.
    if canvas_w_px is None or canvas_h_px is None:
        p0 = src[indices[0]]
        pix0 = p0.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        canvas_w_px = pix0.width
        canvas_h_px = pix0.height

    page_w_pt = canvas_w_px / zoom
    page_h_pt = canvas_h_px / zoom
    straight_cache.mkdir(parents=True, exist_ok=True)

    out = fitz.open()
    for i in tqdm(indices, desc="Straighten"):
        page = src[i]
        cache_file = straight_cache / f"page_{i:04d}.json"

        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        rgb = np.array(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))

        if cache_file.exists() and not force:
            meta = json.loads(cache_file.read_text(encoding="utf-8"))
            flip = bool(meta.get("flip_180", False))
            deskew = float(meta.get("deskew_clockwise_deg", 0))
            env = tuple(meta.get("envelope_norm", [0, 0, 1000, 1000]))
        else:
            lines = load_or_ocr_lines(page, i, bbox_cache, model, image_scale)
            flip = needs_flip_180(lines, page.rotation)
            work = rotate_image(rgb, 180.0) if flip else rgb
            gray = work.mean(axis=2).astype(np.uint8)
            rough = angle_from_line_bboxes(lines)
            deskew = refine_angle(gray, rough if rough is not None else 0.0)
            if abs(deskew) < 0.08:
                deskew = 0.0
            env = envelope_norm(lines)
            if flip:
                env = flip_envelope(env)
            meta = {
                "flip_180": flip,
                "deskew_clockwise_deg": deskew,
                "envelope_norm": list(env),
                "pdf_rotation": page.rotation,
            }
            cache_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

        env_t = tuple(meta.get("envelope_norm", [0, 0, 1000, 1000]))  # type: ignore[assignment]
        flip = bool(meta.get("flip_180", False))
        deskew = float(meta.get("deskew_clockwise_deg", 0))

        img = rotate_image(rgb, 180.0) if flip else rgb
        img = rotate_image(img, deskew)
        canvas = center_on_canvas(img, env_t, canvas_w_px, canvas_h_px)

        new_page = out.new_page(width=page_w_pt, height=page_h_pt)
        buf = io.BytesIO()
        Image.fromarray(canvas).save(buf, format="JPEG", quality=92, optimize=True)
        new_page.insert_image(new_page.rect, stream=buf.getvalue())
        tqdm.write(
            f"page {i}: flip180={flip} deskew={deskew:+.2f}° rot_meta={page.rotation}"
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    out.save(str(output), garbage=4, deflate=True)
    out.close()
    src.close()
    print(f"Saved {len(indices)} pages -> {output} ({page_w_pt:.1f}x{page_h_pt:.1f} pt)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Straighten scan PDF: flip180 + deskew + center")
    parser.add_argument("book_id", help="e.g. 15")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--bbox-cache", type=Path)
    parser.add_argument("--cache-dir", type=Path, help="Straighten meta cache")
    parser.add_argument("--zoom", type=float, default=2.0)
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=None)
    parser.add_argument("--max-pages", type=int, default=None)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    book_id = args.book_id
    source = args.source or (BASE_DIR / "data" / "pdf" / f"{book_id}.pdf")
    output = args.output or (BASE_DIR / "data" / "pdf" / f"{book_id}-straight.pdf")
    bbox_cache = args.bbox_cache or (BASE_DIR / "text" / f".searchable-{book_id}")
    straight_cache = args.cache_dir or (BASE_DIR / "text" / f".straight-{book_id}")

    straighten_pdf(
        source,
        output,
        bbox_cache=bbox_cache,
        straight_cache=straight_cache,
        model=args.model,
        zoom=args.zoom,
        start_page=args.start_page,
        end_page=args.end_page,
        max_pages=args.max_pages,
        force=args.force,
    )


if __name__ == "__main__":
    main()
