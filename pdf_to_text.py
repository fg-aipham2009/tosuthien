#!/usr/bin/env python3
"""
PDF → text for Buddhist books.

- Prefer full OCR (--ocr) for scan PDFs so page numbers match the printed book.
- Blank page = original page is empty/near-blank (kept as --- N --- with empty body).
- Parallel page OCR via ThreadPoolExecutor for speed.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock

import anthropic
import fitz  # pymupdf
from dotenv import load_dotenv
from tqdm import tqdm

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR / "scripts"))
from vni_convert import to_unicode  # noqa: E402

load_dotenv(BASE_DIR / ".env")


def fix_vn_pdf_text(text: str) -> str:
    if not text.strip():
        return text
    return to_unicode(text, "VNI_WIN")


SHOPAIKEY_BASE_URL = os.environ.get("SHOPAIKEY_BASE_URL", "https://api.shopaikey.com").rstrip("/")
SHOPAIKEY_API_KEY = os.environ.get("SHOPAIKEY_API_KEY")
NEXUS_BASE_URL = os.environ.get("NEXUS_BASE_URL", "https://nexusmmo.store/api/v1").rstrip("/")
NEXUS_API_KEY = os.environ.get("NEXUS_API_KEY")
TAPHOA_BASE_URL = os.environ.get("TAPHOA_BASE_URL", "https://taphoaapi.info.vn").rstrip("/")
TAPHOA_API_KEY = os.environ.get("TAPHOA_API_KEY")
HHTECH_BASE_URL = os.environ.get("HHTECH_BASE_URL", "https://hhtechapi.com/v1").rstrip("/")
HHTECH_API_KEY = os.environ.get("HHTECH_API_KEY")
OCR_PROVIDER = (os.environ.get("OCR_PROVIDER") or "shopaikey").strip().lower()
OCR_MODEL = os.environ.get("OCR_MODEL") or os.environ.get("CHAT_MODEL") or "claude-opus-4-8"
OCR_WORKERS_DEFAULT = int(os.environ.get("OCR_WORKERS") or "8")


def build_ocr_client() -> anthropic.Anthropic:
    if OCR_PROVIDER == "hhtech":
        if not HHTECH_API_KEY:
            raise SystemExit("❌ OCR_PROVIDER=hhtech nhưng thiếu HHTECH_API_KEY trong .env")
        return anthropic.Anthropic(api_key=HHTECH_API_KEY, base_url=HHTECH_BASE_URL)
    if OCR_PROVIDER == "taphoa":
        if not TAPHOA_API_KEY:
            raise SystemExit("❌ OCR_PROVIDER=taphoa nhưng thiếu TAPHOA_API_KEY trong .env")
        return anthropic.Anthropic(api_key=TAPHOA_API_KEY, base_url=TAPHOA_BASE_URL)
    if OCR_PROVIDER == "nexus":
        if not NEXUS_API_KEY:
            raise SystemExit("❌ OCR_PROVIDER=nexus nhưng thiếu NEXUS_API_KEY trong .env")
        return anthropic.Anthropic(api_key=NEXUS_API_KEY, base_url=NEXUS_BASE_URL)
    if not SHOPAIKEY_API_KEY:
        raise SystemExit("❌ Thiếu SHOPAIKEY_API_KEY trong .env")
    return anthropic.Anthropic(api_key=SHOPAIKEY_API_KEY, base_url=SHOPAIKEY_BASE_URL)


client = build_ocr_client()
OCR_PROVIDER_LABEL = {
    "hhtech": "HHTechAPI",
    "taphoa": "TaphoaAPI",
    "nexus": "Nexus",
}.get(OCR_PROVIDER, "ShopAIKey")

DEFAULT_INPUT = BASE_DIR / "data" / "pdf"
DEFAULT_OUTPUT = BASE_DIR / "text"

TEXT_THRESHOLD = 100
PAGE_TEXT_MIN = 80
IMAGE_SCALE = 2.0
PRINT_LOCK = Lock()

OCR_PROMPT = """Bạn là công cụ OCR cho kinh sách Phật giáo tiếng Việt.
Trích TOÀN BỘ chữ trên trang ảnh này.

Yêu cầu bắt buộc:
- Giữ nguyên tiếng Việt có dấu
- Giữ xuống dòng, đoạn văn
- Giữ chữ Hán nếu có
- CHỈ trả về text thuần trên trang
- Nếu trang hoàn toàn trống / không có chữ: trả về đúng một dòng: __BLANK__
- KHÔNG từ chối, KHÔNG hỏi user gửi ảnh, KHÔNG giải thích"""

BLANK_MARKERS = re.compile(
    r"^(?:__BLANK__|TRANG_TRONG|\[BLANK\]|\(blank\)|trang này trống.*)$",
    re.IGNORECASE,
)


def embedded_text_sample(pdf_path: str, max_pages: int = 8) -> str:
    doc = fitz.open(pdf_path)
    n = min(max_pages, doc.page_count)
    text = "".join(doc[i].get_text() for i in range(n))
    doc.close()
    return text


def text_looks_garbled(text: str) -> bool:
    """Broken PDF font maps often drop Vietnamese diacritics (~, (> substitutions)."""
    sample = text[:80_000]
    if len(sample) < 200:
        return False
    if sample.count("~") >= max(12, len(sample) * 0.0015):
        return True
    bad = sum(sample.count(c) for c in "(>!{]")
    if bad >= max(15, len(sample) * 0.001):
        return True
    vn = "àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ"
    if len(sample) > 2_000 and sum(sample.count(c) for c in vn) < len(sample) * 0.006:
        return True
    broken_markers = (
        "GIAÙO HOÄI",
        "PHAÄT GIAÙO",
        "VIEÄT NAM",
        "LAÊNG NGHIEÂM",
        "LAÊNG GIAØ",
        "THÍCH DUY LÖÏC",
        "DUY LÖÏC",
        "Nghieâm",
        "Giaûi",
    )
    if any(m in sample for m in broken_markers):
        return True
    return False


def pdf_co_text(pdf_path: str) -> bool:
    sample = embedded_text_sample(pdf_path)
    if len(sample.strip()) <= TEXT_THRESHOLD:
        return False
    return not text_looks_garbled(sample)


def extract_response_text(response) -> str:
    chunks: list[str] = []
    for block in response.content:
        if block.type == "text":
            chunks.append(block.text)
    if not chunks:
        raise ValueError(f"No text block in response: {[b.type for b in response.content]}")
    return "\n".join(chunks)


def normalize_ocr_text(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    if BLANK_MARKERS.match(t):
        return ""
    # Model sometimes wraps blank marker with noise.
    if t.upper() in {"__BLANK__", "TRANG_TRONG", "[BLANK]"}:
        return ""
    return t


def ocr_via_openai_chat(image_bytes: bytes) -> str:
    """OpenAI-compatible /chat/completions — better for gpt-* models on HHTech."""
    image_b64 = base64.standard_b64encode(image_bytes).decode()
    body = {
        "model": OCR_MODEL,
        "max_tokens": 8192,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": OCR_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64}",
                        },
                    },
                ],
            }
        ],
    }
    url = f"{HHTECH_BASE_URL}/chat/completions"
    data = json.dumps(body).encode()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {HHTECH_API_KEY}",
    }

    last_err: Exception | None = None
    for attempt in range(1, 5):
        req = urllib.request.Request(url, data=data, method="POST", headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as err:
            last_err = err
            if err.code in (408, 429, 500, 502, 503, 504) and attempt < 4:
                wait_s = min(60, 5 * attempt * attempt)
                with PRINT_LOCK:
                    print(f"    ↻ OCR HTTP {err.code}, retry {attempt}/3 after {wait_s}s")
                time.sleep(wait_s)
                continue
            raise
        except (TimeoutError, urllib.error.URLError) as err:
            last_err = err
            if attempt < 4:
                wait_s = min(60, 5 * attempt * attempt)
                with PRINT_LOCK:
                    print(f"    ↻ OCR network error, retry {attempt}/3 after {wait_s}s")
                time.sleep(wait_s)
                continue
            raise
    else:
        raise last_err or RuntimeError("OCR request failed")

    choice = (payload.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return normalize_ocr_text(content)
    if isinstance(content, list):
        texts = [
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        ]
        joined = "\n".join(t for t in texts if t).strip()
        if joined:
            return normalize_ocr_text(joined)
    # Empty content often means blank/near-blank page on some GPT routes.
    return ""


def ocr_trang_bang_claude(image_bytes: bytes) -> str:
    if OCR_MODEL.lower().startswith("gpt-") and OCR_PROVIDER == "hhtech":
        return ocr_via_openai_chat(image_bytes)

    image_b64 = base64.standard_b64encode(image_bytes).decode()
    last_err = None
    for max_tokens in (4096, 8192):
        try:
            response = client.messages.create(
                model=OCR_MODEL,
                max_tokens=max_tokens,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": image_b64,
                                },
                            },
                            {"type": "text", "text": OCR_PROMPT},
                        ],
                    }
                ],
            )
            return normalize_ocr_text(extract_response_text(response))
        except ValueError as err:
            last_err = err
            continue
    if last_err:
        raise last_err
    raise RuntimeError("OCR failed without response")


def page_needs_ocr(page: fitz.Page) -> bool:
    return len(page.get_text().strip()) < PAGE_TEXT_MIN


def pixmap_is_blank(pix: fitz.Pixmap, max_std: float = 7.0, min_mean: float = 235.0) -> bool:
    """True when page image is nearly uniform (usually blank/white)."""
    if pix.width < 2 or pix.height < 2:
        return True
    n = pix.n
    samples = pix.samples
    # Sample ~4k pixels for speed.
    total_px = pix.width * pix.height
    step = max(1, total_px // 4000)
    vals: list[float] = []
    for i in range(0, len(samples), n * step):
        if i + max(0, n - 1) >= len(samples):
            break
        if n >= 3:
            vals.append((samples[i] + samples[i + 1] + samples[i + 2]) / 3.0)
        else:
            vals.append(float(samples[i]))
    if len(vals) < 20:
        return True
    mean = sum(vals) / len(vals)
    var = sum((v - mean) ** 2 for v in vals) / len(vals)
    return var < (max_std * max_std) and mean >= min_mean


def page_path_for(cache_dir: Path, index: int) -> Path:
    return cache_dir / f"page_{index:04d}.txt"


def image_path_for(cache_dir: Path, index: int) -> Path:
    return cache_dir / "images" / f"page_{index:04d}.jpg"


def assemble_book_text(cache_dir: Path, page_count: int) -> tuple[str, int]:
    parts: list[str] = []
    blank = 0
    for i in range(page_count):
        path = page_path_for(cache_dir, i)
        text = path.read_text(encoding="utf-8") if path.exists() else ""
        if not text.strip():
            blank += 1
        parts.append(f"--- {i + 1} ---\n{text}".rstrip())
    return "\n\n".join(parts) + "\n", blank


def ocr_single_cached_page(cache_dir: Path, index: int) -> tuple[int, bool]:
    """OCR one page from cached JPEG. Returns (index, is_blank)."""
    out = page_path_for(cache_dir, index)
    if out.exists():
        return index, not out.read_text(encoding="utf-8").strip()

    img = image_path_for(cache_dir, index)
    if not img.exists():
        out.write_text("", encoding="utf-8")
        return index, True

    image_bytes = img.read_bytes()
    if len(image_bytes) < 1800:
        out.write_text("", encoding="utf-8")
        return index, True

    try:
        text = ocr_trang_bang_claude(image_bytes)
    except ValueError as err:
        if "Empty OCR content" in str(err):
            text = ""
        else:
            raise
    out.write_text(text + ("\n" if text else ""), encoding="utf-8")
    return index, not bool(text.strip())


def ocr_pdf_pages(
    pdf_path: Path,
    output_dir: Path,
    ten_file: str,
    *,
    workers: int = 8,
    clean: bool = False,
) -> str:
    cache_dir = output_dir / f".ocr-{ten_file}"
    if clean and cache_dir.exists():
        shutil.rmtree(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / "images").mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf_path))
    page_count = doc.page_count
    mat = fitz.Matrix(IMAGE_SCALE, IMAGE_SCALE)

    # Phase 1: render pages that still need OCR (sequential; CPU/IO bound).
    todo: list[int] = []
    blank_render = 0
    print(f"  🖼  Render ảnh trang ({page_count})...")
    for i in range(page_count):
        out = page_path_for(cache_dir, i)
        if out.exists():
            continue
        img = image_path_for(cache_dir, i)
        if not img.exists():
            pix = doc[i].get_pixmap(matrix=mat, alpha=False)
            if pixmap_is_blank(pix):
                out.write_text("", encoding="utf-8")
                blank_render += 1
                continue
            img.write_bytes(pix.tobytes("jpeg", jpg_quality=85))
        todo.append(i)
    doc.close()

    if blank_render:
        print(f"  ⏭ {blank_render} trang trống (detect từ ảnh)")

    # Phase 2: OCR missing pages in parallel.
    if todo:
        workers = max(1, min(workers, len(todo)))
        print(
            f"  📷 OCR {len(todo)}/{page_count} trang "
            f"({OCR_PROVIDER_LABEL} {OCR_MODEL}, workers={workers})..."
        )
        blank_ocr = 0
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(ocr_single_cached_page, cache_dir, i) for i in todo]
            with tqdm(total=len(futures), desc=f"  OCR {ten_file}", unit="trang") as bar:
                for fut in as_completed(futures):
                    _, is_blank = fut.result()
                    if is_blank:
                        blank_ocr += 1
                    bar.update(1)
        if blank_ocr:
            print(f"  ⏭ {blank_ocr} trang OCR trả về trống")
    else:
        print(f"  ✓ Cache đủ {page_count} trang — ghép file")

    text, blank_total = assemble_book_text(cache_dir, page_count)
    print(f"  📄 {page_count} trang ({blank_total} trống thật)")
    return text


def hybrid_pdf_pages(
    pdf_path: Path,
    output_dir: Path,
    ten_file: str,
    *,
    ocr_missing: bool = False,
    workers: int = 8,
) -> str:
    """Embedded text when good; OCR missing/scan pages when requested."""
    if ocr_missing:
        # Prefer full OCR assembly path so markers stay contiguous 1..N.
        return ocr_pdf_pages(pdf_path, output_dir, ten_file, workers=workers, clean=False)

    doc = fitz.open(str(pdf_path))
    cache_dir = output_dir / f".ocr-{ten_file}"
    cache_dir.mkdir(parents=True, exist_ok=True)
    parts: list[str] = []
    direct_count = 0
    skip_count = 0

    for i, page in enumerate(tqdm(doc, desc="  Trang", total=doc.page_count)):
        page_path = page_path_for(cache_dir, i)
        raw = page.get_text().strip()

        if page_path.exists():
            cached = page_path.read_text(encoding="utf-8")
            if cached == "__SKIP__":
                skip_count += 1
                parts.append("")
            else:
                parts.append(fix_vn_pdf_text(cached))
            continue

        if page_needs_ocr(page):
            skip_count += 1
            page_path.write_text("__SKIP__", encoding="utf-8")
            parts.append("")
            continue

        direct_count += 1
        page_text = fix_vn_pdf_text(raw)
        page_path.write_text(page_text, encoding="utf-8")
        parts.append(page_text)

    doc.close()
    if skip_count:
        print(f"  ⏭ Bỏ {skip_count} trang scan (dùng --ocr hoặc --ocr-missing)")
    print(f"  ✓ {direct_count} trang text layer")
    return "\n\n".join(f"--- {i + 1} ---\n{t}".rstrip() for i, t in enumerate(parts)) + "\n"


def xu_ly_pdf(
    pdf_path: Path,
    output_dir: Path,
    force: bool = False,
    force_ocr: bool = False,
    ocr_missing: bool = False,
    workers: int = 8,
    clean: bool = False,
) -> None:
    ten_file = pdf_path.stem
    output_path = output_dir / f"{ten_file}.txt"

    if output_path.exists() and not force and not clean:
        print(f"  ⏭ Đã có: {ten_file}.txt (dùng --force để ghi đè)")
        return

    print(f"\n📄 {pdf_path.name} → {output_path.name}")

    doc = fitz.open(str(pdf_path))
    all_have_text = all(not page_needs_ocr(p) for p in doc)
    page_count = doc.page_count
    doc.close()
    print(f"  ℹ {page_count} trang PDF")

    if force_ocr:
        print("  ⚠️  --ocr: OCR toàn bộ (song song)")
        text = ocr_pdf_pages(
            pdf_path,
            output_dir,
            ten_file,
            workers=workers,
            clean=clean,
        )
    elif all_have_text and pdf_co_text(str(pdf_path)):
        print("  ✓ Text layer OK — đọc trực tiếp")
        doc = fitz.open(str(pdf_path))
        parts = [
            f"--- {i + 1} ---\n{fix_vn_pdf_text(page.get_text().strip())}"
            for i, page in enumerate(doc)
        ]
        doc.close()
        text = "\n\n".join(parts) + "\n"
    else:
        text = hybrid_pdf_pages(
            pdf_path,
            output_dir,
            ten_file,
            ocr_missing=ocr_missing,
            workers=workers,
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path.write_text(text, encoding="utf-8")
    print(f"  ✅ {len(text):,} ký tự → {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="PDF → text (parallel OCR)")
    parser.add_argument(
        "files",
        nargs="*",
        help="Tên file (9, 11) hoặc đường dẫn PDF. Bỏ trống = mọi PDF trong --input",
    )
    parser.add_argument("--input", "-i", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", "-o", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--force", "-f", action="store_true", help="Ghi đè file .txt đã có")
    parser.add_argument("--ocr", action="store_true", help="Bắt buộc OCR toàn bộ")
    parser.add_argument(
        "--ocr-missing",
        action="store_true",
        help="OCR trang scan trong chế độ hybrid",
    )
    parser.add_argument(
        "--workers",
        "-w",
        type=int,
        default=OCR_WORKERS_DEFAULT,
        help=f"Số luồng OCR song song (default {OCR_WORKERS_DEFAULT})",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Xóa cache .ocr-{id}/ trước khi OCR lại",
    )
    args = parser.parse_args()

    if OCR_PROVIDER not in ("nexus", "taphoa", "hhtech") and not SHOPAIKEY_API_KEY:
        raise SystemExit("❌ Thiếu SHOPAIKEY_API_KEY trong .env")

    if args.files:
        pdfs: list[Path] = []
        for name in args.files:
            p = Path(name)
            if p.suffix.lower() == ".pdf":
                pdfs.append(p if p.is_absolute() else args.input / p.name)
            else:
                pdfs.append(args.input / f"{name}.pdf")
    else:
        pdfs = sorted(args.input.glob("*.pdf"))

    missing = [p for p in pdfs if not p.exists()]
    if missing:
        raise SystemExit("❌ Không tìm thấy:\n" + "\n".join(f"  {p}" for p in missing))

    print(f"OCR provider: {OCR_PROVIDER_LABEL}")
    print(f"OCR model: {OCR_MODEL}")
    print(f"Workers: {args.workers}")
    print(f"Output: {args.output}\n")

    for pdf_path in pdfs:
        xu_ly_pdf(
            pdf_path,
            args.output,
            force=args.force,
            force_ocr=args.ocr,
            ocr_missing=args.ocr_missing,
            workers=args.workers,
            clean=args.clean,
        )

    print("\n🎉 Xong!")


if __name__ == "__main__":
    main()
