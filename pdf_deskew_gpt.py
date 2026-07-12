"""
Deskew scanned PDF pages — keep full page, no crop.

Angle detection (in order):
1) Median slope of wide OCR line bboxes (GPT vision)
2) Fine-tune ±1.5° via row projection on the raster
3) Fallback: direct GPT angle estimate (blank/sparse pages)
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import math
import os
import re
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

SKEW_PROMPT = """Trang sách scan. Ước lượng góc nghiêng DÒNG CHỮ so với ngang.

Trả JSON thuần: {"rotate_clockwise_deg": 0.0}

rotate_clockwise_deg = độ xoay ẢNH theo chiều kim đồng hồ để chữ thẳng.
Thường -3..+3. Chỉ JSON."""


def parse_angle(raw: str) -> float:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    data = json.loads(text[start : end + 1])
    angle = float(data.get("rotate_clockwise_deg", data.get("angle_deg", 0)))
    return max(-8.0, min(8.0, angle))


def ask_skew_angle(image_bytes: bytes, model: str) -> float:
    if not HHTECH_API_KEY:
        raise SystemExit("Missing HHTECH_API_KEY in .env")
    image_b64 = base64.standard_b64encode(image_bytes).decode()
    body = {
        "model": model,
        "max_tokens": 128,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": SKEW_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                ],
            }
        ],
    }
    req = urllib.request.Request(
        f"{HHTECH_BASE_URL}/chat/completions",
        data=json.dumps(body).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {HHTECH_API_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    content = (payload.get("choices") or [{}])[0].get("message", {}).get("content", "")
    if isinstance(content, list):
        content = "\n".join(p.get("text", "") for p in content if p.get("type") == "text")
    return parse_angle(str(content))


def angle_from_line_bboxes(lines: list[dict], min_width: float = 220.0) -> float | None:
    """Median tilt of wide text lines (degrees clockwise from horizontal)."""
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
    # Drop outliers (centered titles etc.)
    med = median(angles)
    filtered = [a for a in angles if abs(a - med) <= 2.5]
    if len(filtered) < 3:
        filtered = angles
    return float(median(filtered))


def projection_score(gray: np.ndarray, rotate_clockwise_deg: float) -> float:
    if abs(rotate_clockwise_deg) >= 0.01:
        gray = np.array(
            Image.fromarray(gray).rotate(
                -rotate_clockwise_deg,
                expand=False,
                resample=Image.Resampling.BILINEAR,
                fillcolor=255,
            )
        )
    h, w = gray.shape
    roi = gray[int(h * 0.12) : int(h * 0.88), int(w * 0.08) : int(w * 0.92)]
    mask = roi < np.percentile(roi, 38)
    return float(mask.sum(axis=1).astype(np.float64).var())


def refine_angle(gray: np.ndarray, rough: float, span: float = 1.5, step: float = 0.05) -> float:
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
    if len(png) < 2500:
        lines: list[dict] = []
    else:
        lines = ocr_page_lines(png, model)
    bbox_cache.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(lines, ensure_ascii=False, indent=2), encoding="utf-8")
    return lines


def detect_deskew_angle(
    page: fitz.Page,
    page_index: int,
    rgb: np.ndarray,
    *,
    bbox_cache: Path,
    deskew_cache: Path,
    model: str,
    image_scale: float,
    force: bool,
) -> tuple[float, str]:
    cache_file = deskew_cache / f"page_{page_index:04d}.json"
    if cache_file.exists() and not force:
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        return float(data["rotate_clockwise_deg"]), str(data.get("method", "cache"))

    gray = rgb.mean(axis=2).astype(np.uint8)
    lines = load_or_ocr_lines(page, page_index, bbox_cache, model, image_scale)
    rough = angle_from_line_bboxes(lines)

    if rough is not None:
        angle = refine_angle(gray, rough)
        method = "bbox+projection"
    else:
        buf = io.BytesIO()
        Image.fromarray(rgb).save(buf, format="JPEG", quality=80)
        angle = ask_skew_angle(buf.getvalue(), model)
        method = "gpt-fallback"

    angle = max(-8.0, min(8.0, angle))
    if abs(angle) < 0.08:
        angle = 0.0

    deskew_cache.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(
        json.dumps({"rotate_clockwise_deg": angle, "method": method}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return angle, method


def rotate_keep_size(rgb: np.ndarray, rotate_clockwise_deg: float) -> np.ndarray:
    if abs(rotate_clockwise_deg) < 0.05:
        return rgb
    return np.array(
        Image.fromarray(rgb).rotate(
            -rotate_clockwise_deg,
            expand=False,
            resample=Image.Resampling.BICUBIC,
            fillcolor=(255, 255, 255),
        )
    )


def deskew_pdf(
    source: Path,
    output: Path,
    *,
    bbox_cache: Path,
    deskew_cache: Path,
    model: str,
    zoom: float = 2.0,
    image_scale: float = 1.5,
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

    out = fitz.open()
    for i in tqdm(indices, desc="Deskew"):
        page = src[i]
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        rgb = np.array(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
        page_w, page_h = pix.width / zoom, pix.height / zoom

        angle, method = detect_deskew_angle(
            page, i, rgb,
            bbox_cache=bbox_cache,
            deskew_cache=deskew_cache,
            model=model,
            image_scale=image_scale,
            force=force,
        )
        fixed = rotate_keep_size(rgb, angle)
        new_page = out.new_page(width=page_w, height=page_h)
        buf = io.BytesIO()
        Image.fromarray(fixed).save(buf, format="JPEG", quality=92, optimize=True)
        new_page.insert_image(new_page.rect, stream=buf.getvalue())
        tqdm.write(f"page {i}: {angle:+.2f}° ({method})")

    output.parent.mkdir(parents=True, exist_ok=True)
    out.save(str(output), garbage=4, deflate=True)
    out.close()
    src.close()
    print(f"Saved {len(indices)} pages -> {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Deskew PDF via OCR line bboxes + projection refine")
    parser.add_argument("book_id", help="e.g. 15")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--bbox-cache", type=Path)
    parser.add_argument("--cache-dir", type=Path, help="Deskew angle cache")
    parser.add_argument("--zoom", type=float, default=2.0)
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=None)
    parser.add_argument("--max-pages", type=int, default=None)
    parser.add_argument("--force", action="store_true", help="Recompute angles even if cached")
    args = parser.parse_args()

    book_id = args.book_id
    source = args.source or (BASE_DIR / "data" / "pdf" / f"{book_id}.pdf")
    output = args.output or (BASE_DIR / "data" / "pdf" / f"{book_id}-deskew-gpt.pdf")
    bbox_cache = args.bbox_cache or (BASE_DIR / "text" / f".searchable-{book_id}")
    deskew_cache = args.cache_dir or (BASE_DIR / "text" / f".deskew-{book_id}")

    deskew_pdf(
        source,
        output,
        bbox_cache=bbox_cache,
        deskew_cache=deskew_cache,
        model=args.model,
        zoom=args.zoom,
        start_page=args.start_page,
        end_page=args.end_page,
        max_pages=args.max_pages,
        force=args.force,
    )


if __name__ == "__main__":
    main()
