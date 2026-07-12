"""
Searchable PDF from scanned books: keep original page image + invisible GPT text layer.

Uses HHTech /chat/completions (gpt-5.6-sol) with JSON line bounding boxes.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

import fitz
from dotenv import load_dotenv
from tqdm import tqdm

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

HHTECH_BASE_URL = os.environ.get("HHTECH_BASE_URL", "https://hhtechapi.com/v1").rstrip("/")
HHTECH_API_KEY = os.environ.get("HHTECH_API_KEY", "")
DEFAULT_MODEL = "gpt-5.6-sol"
IMAGE_SCALE = 1.5
FONT_PATH = "/System/Library/Fonts/Supplemental/Times New Roman.ttf"

OCR_JSON_PROMPT = """OCR trang kinh sách Phật giáo tiếng Việt.

Trả về JSON array — mỗi phần tử là MỘT DÒNG text trên trang:
[{"text":"...","x0":0,"y0":0,"x1":1000,"y1":20}]

Quy tắc:
- x0,y0,x1,y1: tọa độ normalized 0-1000 (góc trái-trên = 0,0; y tăng xuống dưới)
- Mỗi dòng in trên ảnh = 1 object (KHÔNG gộp dòng)
- Giữ đúng tiếng Việt có dấu, giữ chữ Hán nếu có
- CHỈ trả JSON thuần, không markdown, không giải thích"""


def parse_json_lines(raw: str) -> list[dict]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("[")
    end = text.rfind("]")
    if start < 0 or end <= start:
        raise ValueError(f"No JSON array in response: {raw[:300]!r}")
    chunk = text[start : end + 1]
    try:
        data = json.loads(chunk)
    except json.JSONDecodeError:
        # Truncated response — salvage complete objects.
        partial = chunk.rsplit("}", 1)[0] + "}]"
        data = json.loads(partial)
    if not isinstance(data, list):
        raise ValueError("Expected JSON array")
    out: list[dict] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        t = str(item.get("text", "")).strip()
        if not t:
            continue
        out.append(
            {
                "text": t,
                "x0": float(item.get("x0", 0)),
                "y0": float(item.get("y0", 0)),
                "x1": float(item.get("x1", 1000)),
                "y1": float(item.get("y1", 1000)),
            }
        )
    return out


def ocr_page_lines(image_bytes: bytes, model: str) -> list[dict]:
    if not HHTECH_API_KEY:
        raise SystemExit("Missing HHTECH_API_KEY in .env")

    image_b64 = base64.standard_b64encode(image_bytes).decode()
    body = {
        "model": model,
        "max_tokens": 8192,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": OCR_JSON_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{image_b64}"},
                    },
                ],
            }
        ],
    }
    req = urllib.request.Request(
        f"{HHTECH_BASE_URL}/chat/completions",
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {HHTECH_API_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode("utf-8", errors="replace")[:500]) from e

    message = (payload.get("choices") or [{}])[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, list):
        content = "\n".join(
            p.get("text", "")
            for p in content
            if isinstance(p, dict) and p.get("type") == "text"
        )
    if not content or not str(content).strip():
        reasoning = message.get("reasoning_content")
        if reasoning:
            raise ValueError(f"Empty OCR content (reasoning only): {str(reasoning)[:200]}")
        raise ValueError(f"Empty OCR content: {payload!r}"[:500])
    return parse_json_lines(str(content))


def norm_to_point(x: float, y: float, rect: fitz.Rect) -> tuple[float, float]:
    return (rect.x0 + (x / 1000.0) * rect.width, rect.y0 + (y / 1000.0) * rect.height)


def add_invisible_lines(page: fitz.Page, lines: list[dict], font_path: str = FONT_PATH) -> None:
    rect = page.rect
    font = fitz.Font(fontfile=font_path)
    writer = fitz.TextWriter(page.rect)
    for line in lines:
        x0, y0, x1, y1 = line["x0"], line["y0"], line["x1"], line["y1"]
        px0, py0 = norm_to_point(x0, y0, rect)
        px1, py1 = norm_to_point(x1, y1, rect)
        box_h = max(8.0, py1 - py0)
        fontsize = max(7.0, box_h * 0.82)
        # Baseline near bottom of OCR box.
        point = fitz.Point(px0, py1 - box_h * 0.12)
        writer.append(
            point,
            line["text"],
            font=font,
            fontsize=fontsize,
        )
    # render_mode=3 => invisible text (copy/search), image stays visible underneath.
    writer.write_text(page, render_mode=3)


def build_searchable_pdf(
    source_pdf: Path,
    output_pdf: Path,
    *,
    cache_dir: Path,
    model: str = DEFAULT_MODEL,
    start_page: int = 0,
    end_page: int | None = None,
    max_pages: int | None = None,
) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    src = fitz.open(source_pdf)
    out = fitz.open()
    last = src.page_count if end_page is None else min(end_page + 1, src.page_count)
    indices = list(range(start_page, last))
    if max_pages is not None:
        indices = indices[:max_pages]

    for i in tqdm(indices, desc="Pages"):
        cache_file = cache_dir / f"page_{i:04d}.json"
        src_page = src[i]
        rect = src_page.rect
        new_page = out.new_page(width=rect.width, height=rect.height)
        new_page.show_pdf_page(rect, src, i)

        if cache_file.exists():
            lines = json.loads(cache_file.read_text(encoding="utf-8"))
        else:
            mat = fitz.Matrix(IMAGE_SCALE, IMAGE_SCALE)
            pix = src_page.get_pixmap(matrix=mat)
            png = pix.tobytes("png")
            if len(png) < 2500:
                lines = []
            else:
                lines = ocr_page_lines(png, model)
            cache_file.write_text(json.dumps(lines, ensure_ascii=False, indent=2), encoding="utf-8")

        if lines:
            add_invisible_lines(new_page, lines)

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    out.save(str(output_pdf))
    out.close()
    src.close()
    print(f"Saved {len(indices)} pages -> {output_pdf}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scan PDF -> searchable PDF (HHTech GPT + bbox)")
    parser.add_argument("book_id", help="e.g. 15")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--start-page", type=int, default=0)
    parser.add_argument("--end-page", type=int, default=None)
    parser.add_argument("--max-pages", type=int, default=None)
    args = parser.parse_args()

    book_id = args.book_id
    source = args.source or (BASE_DIR / "data" / "pdf" / f"{book_id}.pdf")
    output = args.output or (BASE_DIR / "data" / "pdf" / f"{book_id}-searchable-gpt.pdf")
    cache = args.cache_dir or (BASE_DIR / "text" / f".searchable-{book_id}")

    build_searchable_pdf(
        source,
        output,
        cache_dir=cache,
        model=args.model,
        start_page=args.start_page,
        end_page=args.end_page,
        max_pages=args.max_pages,
    )


if __name__ == "__main__":
    main()
