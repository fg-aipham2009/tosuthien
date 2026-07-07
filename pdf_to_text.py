"""
Chuyển PDF (kể cả scan ảnh) thành text.
- PDF có text sẵn → đọc trực tiếp
- PDF scan ảnh → OCR từng trang bằng Claude (ShopAIKey hoặc Nexus)
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

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
OCR_PROVIDER = (os.environ.get("OCR_PROVIDER") or "shopaikey").strip().lower()
OCR_MODEL = os.environ.get("OCR_MODEL") or os.environ.get("CHAT_MODEL") or "claude-opus-4-8"


def build_ocr_client() -> anthropic.Anthropic:
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
    "taphoa": "TaphoaAPI",
    "nexus": "Nexus",
}.get(OCR_PROVIDER, "ShopAIKey")

DEFAULT_INPUT = BASE_DIR / "kinhsach"
DEFAULT_OUTPUT = BASE_DIR / "text"

TEXT_THRESHOLD = 100
PAGE_TEXT_MIN = 80
IMAGE_SCALE = 2

OCR_PROMPT = """Bạn là công cụ OCR cho kinh sách Phật giáo tiếng Việt.
Trích TOÀN BỘ chữ trên trang ảnh này.

Yêu cầu bắt buộc:
- Giữ nguyên tiếng Việt có dấu
- Giữ xuống dòng, đoạn văn
- Giữ chữ Hán nếu có
- CHỈ trả về text thuần trên trang
- KHÔNG từ chối, KHÔNG hỏi user gửi ảnh, KHÔNG giải thích"""


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
    # Broken VN PDF font maps (VNI/Tcvn-style mojibake surfaced as Unicode)
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
    """Collect text blocks; skip thinking blocks from extended-thinking models."""
    chunks: list[str] = []
    for block in response.content:
        if block.type == "text":
            chunks.append(block.text)
    if not chunks:
        raise ValueError(f"No text block in response: {[b.type for b in response.content]}")
    return "\n".join(chunks)


def ocr_trang_bang_claude(image_bytes: bytes) -> str:
    image_b64 = base64.standard_b64encode(image_bytes).decode()
    response = client.messages.create(
        model=OCR_MODEL,
        max_tokens=4096,
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
    return extract_response_text(response)


def doc_text_truc_tiep(pdf_path: str) -> str:
    doc = fitz.open(pdf_path)
    text = "".join(page.get_text() + "\n\n" for page in doc)
    doc.close()
    return text


def page_needs_ocr(page: fitz.Page) -> bool:
    return len(page.get_text().strip()) < PAGE_TEXT_MIN


def hybrid_pdf_pages(
    pdf_path: Path,
    output_dir: Path,
    ten_file: str,
    *,
    ocr_missing: bool = False,
) -> str:
    """Use embedded text per page; skip cover scans (or OCR them with ocr_missing=True)."""
    doc = fitz.open(str(pdf_path))
    cache_dir = output_dir / f".ocr-{ten_file}"
    cache_dir.mkdir(parents=True, exist_ok=True)
    parts: list[str] = []
    direct_count = 0
    ocr_count = 0
    skip_count = 0
    page_nums: list[int] = []

    for i, page in enumerate(tqdm(doc, desc="  Trang", total=doc.page_count)):
        page_path = cache_dir / f"page_{i:04d}.txt"
        raw = page.get_text().strip()

        if page_path.exists():
            cached = page_path.read_text(encoding="utf-8")
            if cached == "__SKIP__":
                skip_count += 1
                continue
            parts.append(fix_vn_pdf_text(cached))
            page_nums.append(i + 1)
            continue

        if page_needs_ocr(page):
            if ocr_missing:
                ocr_count += 1
                mat = fitz.Matrix(IMAGE_SCALE, IMAGE_SCALE)
                pix = page.get_pixmap(matrix=mat)
                page_text = ocr_trang_bang_claude(pix.tobytes("jpeg"))
                page_path.write_text(page_text, encoding="utf-8")
                parts.append(page_text)
                page_nums.append(i + 1)
            else:
                skip_count += 1
                page_path.write_text("__SKIP__", encoding="utf-8")
            continue

        direct_count += 1
        page_text = fix_vn_pdf_text(raw)
        page_path.write_text(page_text, encoding="utf-8")
        parts.append(page_text)
        page_nums.append(i + 1)

    doc.close()
    if skip_count:
        print(f"  ⏭ Bỏ {skip_count} trang bìa/scan")
    if ocr_count:
        print(f"  📷 OCR {ocr_count} trang ({OCR_PROVIDER_LABEL})")
    print(f"  ✓ {direct_count} trang text")
    parts_with_markers = [
        f"--- {num} ---\n{text}" for num, text in zip(page_nums, parts)
    ]
    return "\n\n".join(parts_with_markers)


def ocr_pdf_pages(pdf_path: Path, output_dir: Path, ten_file: str) -> str:
    doc = fitz.open(str(pdf_path))
    cache_dir = output_dir / f".ocr-{ten_file}"
    cache_dir.mkdir(parents=True, exist_ok=True)
    done = sum(1 for _ in cache_dir.glob("page_*.txt"))
    if done:
        print(f"  ↻ Tiếp tục từ trang {done + 1}/{doc.page_count}")
    else:
        print(f"  📷 OCR {doc.page_count} trang ({OCR_PROVIDER_LABEL} {OCR_MODEL})...")
    parts: list[str] = []
    for i, page in enumerate(tqdm(doc, desc="  Trang", initial=done, total=doc.page_count)):
        page_path = cache_dir / f"page_{i:04d}.txt"
        if page_path.exists():
            parts.append(page_path.read_text(encoding="utf-8"))
            continue
        mat = fitz.Matrix(IMAGE_SCALE, IMAGE_SCALE)
        pix = page.get_pixmap(matrix=mat)
        page_text = ocr_trang_bang_claude(pix.tobytes("jpeg"))
        page_path.write_text(page_text, encoding="utf-8")
        parts.append(page_text)
    doc.close()
    parts_with_markers = [f"--- {i + 1} ---\n{p}" for i, p in enumerate(parts)]
    return "\n\n".join(parts_with_markers)


def xu_ly_pdf(
    pdf_path: Path,
    output_dir: Path,
    force: bool = False,
    force_ocr: bool = False,
    ocr_missing: bool = False,
) -> None:
    ten_file = pdf_path.stem
    output_path = output_dir / f"{ten_file}.txt"

    if output_path.exists() and not force:
        print(f"  ⏭ Đã có: {ten_file}.txt (dùng --force để ghi đè)")
        return

    print(f"\n📄 {pdf_path.name} → {output_path.name}")

    doc = fitz.open(str(pdf_path))
    all_have_text = all(not page_needs_ocr(p) for p in doc)

    if force_ocr:
        doc.close()
        print("  ⚠️  --ocr: OCR toàn bộ")
        text = ocr_pdf_pages(pdf_path, output_dir, ten_file)
    elif all_have_text and pdf_co_text(str(pdf_path)):
        print("  ✓ Text layer OK — đọc trực tiếp")
        parts = [
            f"--- {i + 1} ---\n{fix_vn_pdf_text(page.get_text().strip())}"
            for i, page in enumerate(doc)
        ]
        doc.close()
        text = "\n\n".join(parts)
    else:
        doc.close()
        text = hybrid_pdf_pages(pdf_path, output_dir, ten_file, ocr_missing=ocr_missing)

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path.write_text(text, encoding="utf-8")
    print(f"  ✅ {len(text):,} ký tự → {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="PDF → text (Claude OCR)")
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
        help="OCR trang scan thay vì bỏ qua (mặc định: bỏ trang bìa)",
    )
    args = parser.parse_args()

    if OCR_PROVIDER not in ("nexus", "taphoa") and not SHOPAIKEY_API_KEY:
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
    print(f"Output: {args.output}\n")

    for pdf_path in pdfs:
        xu_ly_pdf(
            pdf_path,
            args.output,
            force=args.force,
            force_ocr=args.ocr,
            ocr_missing=args.ocr_missing,
        )

    print("\n🎉 Xong!")


if __name__ == "__main__":
    main()
