"""
Normalize scanned book PDFs to upright, de-skewed, uniformly framed pages.

Goal: make each page "front-facing" like digital PDFs (e.g. quyen 19/20).

Strategy per page:
1) Render page to RGB raster.
2) Bake rotation (deskew) by estimating a small skew angle from text lines.
3) Detect content bounding box on the deskewed raster.
4) Crop using a *fixed* target width/height (calibrated from a sample),
   then place into a uniform white canvas.

This reduces:
- left/right jitter caused by different crop extents
- remaining slight slant within a page
"""

from __future__ import annotations

import argparse
import io
from pathlib import Path
from statistics import median

import fitz
import numpy as np
from PIL import Image
from tqdm import tqdm

BASE_DIR = Path(__file__).resolve().parent


def render_page_rgb(page: fitz.Page, zoom: float) -> np.ndarray:
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    return np.array(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))


def otsu_threshold(gray: np.ndarray) -> float:
    """Compute Otsu threshold (returns threshold in [0,255])."""
    g = gray.astype(np.uint8)
    hist = np.bincount(g.ravel(), minlength=256).astype(np.float64)
    total = hist.sum()
    if total <= 0:
        return 127.0
    prob = hist / total
    omega = np.cumsum(prob)
    mu = np.cumsum(prob * np.arange(256))
    mu_t = mu[-1]

    sigma_b2 = (mu_t * omega - mu) ** 2 / (omega * (1 - omega) + 1e-12)
    k = int(np.argmax(sigma_b2))
    return float(k)


def estimate_deskew_angle(
    gray: np.ndarray,
    *,
    max_angle: float = 7.0,
    step: float = 0.25,
    downsample_max_width: int = 520,
) -> float:
    """
    Estimate small skew angle (degrees, counter-clockwise).
    Works without OpenCV by scoring "horizontality" of text lines.
    """
    h, w = gray.shape[:2]
    if h < 50 or w < 50:
        return 0.0

    # Downsample for speed while preserving aspect.
    scale = min(1.0, downsample_max_width / float(w))
    if scale < 1.0:
        new_w = max(50, int(w * scale))
        new_h = max(50, int(h * scale))
        gray_small = np.array(Image.fromarray(gray).resize((new_w, new_h), resample=Image.Resampling.BILINEAR))
    else:
        gray_small = gray

    # Binary mask: dark pixels.
    t = otsu_threshold(gray_small)
    # If threshold too high/low, clamp to keep mask meaningful.
    t = float(np.clip(t, 60.0, 220.0))
    mask = gray_small < t

    # Focus score on the middle band to reduce influence of headers/footers.
    mh = mask.shape[0]
    y0 = int(mh * 0.15)
    y1 = int(mh * 0.85)
    xm = mask.shape[1]
    x0 = int(xm * 0.08)
    x1 = int(xm * 0.92)
    mask_roi = mask[y0:y1, x0:x1]

    # Convert to PIL so rotation uses a good resampler.
    img = Image.fromarray((mask_roi.astype(np.uint8) * 255))

    angles = np.arange(-max_angle, max_angle + 1e-9, step, dtype=np.float64)
    best_angle = 0.0
    best_score = -1.0

    # Precompute for faster scoring.
    for a in angles:
        rot = img.rotate(
            float(a),
            expand=False,
            resample=Image.Resampling.NEAREST,
            fillcolor=255,
        )
        rot_mask = np.array(rot) < 128
        # Row projection: count dark pixels per row.
        proj = rot_mask.sum(axis=1).astype(np.float64)
        # Smooth projection to suppress noise.
        if proj.size >= 7:
            kernel = np.ones(5, dtype=np.float64) / 5.0
            proj = np.convolve(proj, kernel, mode="same")
        score = float(proj.var())
        if score > best_score:
            best_score = score
            best_angle = float(a)

    # If score is weak, don't rotate.
    if abs(best_angle) < 0.15:
        return 0.0
    return best_angle


def content_bbox(gray: np.ndarray, *, white_threshold: int = 245) -> tuple[int, int, int, int] | None:
    """
    Return bbox (x0,y0,x1,y1) in pixel coords where content is likely non-white.
    """
    mask = gray < white_threshold
    if not bool(mask.any()):
        return None
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def crop_center_fixed(
    rgb: np.ndarray,
    bbox: tuple[int, int, int, int],
    *,
    target_w: int,
    target_h: int,
) -> np.ndarray:
    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) / 2.0
    cy = (y0 + y1) / 2.0

    half_w = target_w / 2.0
    half_h = target_h / 2.0

    rx0 = int(round(cx - half_w))
    ry0 = int(round(cy - half_h))
    rx1 = rx0 + target_w
    ry1 = ry0 + target_h

    h, w = rgb.shape[:2]
    # Pad with white if crop goes out of bounds.
    canvas = np.full((target_h, target_w, 3), 255, dtype=np.uint8)

    src_x0 = max(0, rx0)
    src_y0 = max(0, ry0)
    src_x1 = min(w, rx1)
    src_y1 = min(h, ry1)

    dst_x0 = src_x0 - rx0
    dst_y0 = src_y0 - ry0

    canvas[dst_y0 : dst_y0 + (src_y1 - src_y0), dst_x0 : dst_x0 + (src_x1 - src_x0)] = rgb[src_y0:src_y1, src_x0:src_x1]
    return canvas


def deskew_rgb(rgb: np.ndarray) -> tuple[np.ndarray, float]:
    gray = rgb.mean(axis=2).astype(np.uint8)
    angle = estimate_deskew_angle(gray)
    if abs(angle) < 0.01:
        return rgb, 0.0
    out = np.array(
        Image.fromarray(rgb).rotate(
            angle,
            expand=False,
            resample=Image.Resampling.BICUBIC,
            fillcolor=(255, 255, 255),
        )
    )
    return out, angle


def calibrate_targets(
    src: fitz.Document,
    indices: list[int],
    *,
    zoom: float,
    margin_px: int,
) -> tuple[int, int]:
    widths: list[int] = []
    heights: list[int] = []

    for i in tqdm(indices, desc="Calibrate", leave=False):
        rgb = render_page_rgb(src[i], zoom)
        rgb_d, _ = deskew_rgb(rgb)
        gray = rgb_d.mean(axis=2).astype(np.uint8)
        bb = content_bbox(gray)
        if bb is None:
            continue
        x0, y0, x1, y1 = bb
        w = x1 - x0
        h = y1 - y0
        if w > 50 and h > 50:
            widths.append(w)
            heights.append(h)

    if not widths or not heights:
        # Fallback to first page crop.
        rgb = render_page_rgb(src[indices[0]], zoom)
        rgb_d, _ = deskew_rgb(rgb)
        gray = rgb_d.mean(axis=2).astype(np.uint8)
        bb = content_bbox(gray)
        if bb is None:
            raise SystemExit("Failed to calibrate content bbox")
        x0, y0, x1, y1 = bb
        widths = [x1 - x0]
        heights = [y1 - y0]

    tw = int(median(widths)) + 2 * margin_px
    th = int(median(heights)) + 2 * margin_px
    return tw, th


def normalize_pdf(
    source: Path,
    output: Path,
    *,
    zoom: float = 2.0,
    deskew_enabled: bool = True,
    margin_px: int = 20,
    calibrate_pages: int = 30,
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

    # Calibration on a subset.
    calib = indices[: min(len(indices), calibrate_pages)]
    target_w_px, target_h_px = calibrate_targets(
        src, calib, zoom=zoom, margin_px=margin_px
    )

    out = fitz.open()
    page_w_pt = target_w_px / zoom
    page_h_pt = target_h_px / zoom

    for i in tqdm(indices, desc="Normalize"):
        rgb = render_page_rgb(src[i], zoom)
        if deskew_enabled:
            rgb, _ = deskew_rgb(rgb)
        gray = rgb.mean(axis=2).astype(np.uint8)
        bb = content_bbox(gray)
        if bb is None:
            # If empty page, keep it centered as pure white.
            canvas = np.full((target_h_px, target_w_px, 3), 255, dtype=np.uint8)
        else:
            canvas = crop_center_fixed(
                rgb,
                bb,
                target_w=target_w_px,
                target_h=target_h_px,
            )

        page = out.new_page(width=page_w_pt, height=page_h_pt)
        img = Image.fromarray(canvas)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=92, optimize=True)
        page.insert_image(page.rect, stream=buf.getvalue())

    output.parent.mkdir(parents=True, exist_ok=True)
    out.save(str(output), garbage=4, deflate=True)
    out.close()
    src.close()
    print(f"Saved {len(indices)} pages -> {output} ({page_w_pt:.1f}x{page_h_pt:.1f} pt, rotation=0)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Improved normalize for scan deskew + horizontal/vertical framing")
    parser.add_argument("input_pdf", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    parser.add_argument("--zoom", type=float, default=2.0)
    parser.add_argument("--no-deskew", action="store_true")
    parser.add_argument("--margin-px", type=int, default=20)
    parser.add_argument("--calibrate-pages", type=int, default=30)
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=None)
    parser.add_argument("--max-pages", type=int, default=None)
    args = parser.parse_args()

    normalize_pdf(
        args.input_pdf,
        args.output,
        zoom=args.zoom,
        deskew_enabled=not args.no_deskew,
        margin_px=args.margin_px,
        calibrate_pages=args.calibrate_pages,
        start_page=args.start_page,
        end_page=args.end_page,
        max_pages=args.max_pages,
    )


if __name__ == "__main__":
    main()

