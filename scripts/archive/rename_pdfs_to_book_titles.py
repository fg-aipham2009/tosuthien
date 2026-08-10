#!/usr/bin/env python3
"""Rename data/pdf/N.pdf → «Tên sách».pdf and sync pdf_files rows.

Usage (from repo root):
  python3 scripts/rename_pdfs_to_book_titles.py              # local docker tosu_db
  python3 scripts/rename_pdfs_to_book_titles.py --dry-run
  python3 scripts/rename_pdfs_to_book_titles.py --pdf-dir /opt/tosu-thien/data/pdf \\
      --psql 'docker exec -i tosu_db psql -U tosuthien -d tosuthien'

Idempotent: skips rows whose filename already matches the target.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_PDF_DIR = REPO / "data" / "pdf"
PUBLIC_BASE = os.environ.get("PUBLIC_BASE_URL", "https://api.tosuthien.net").rstrip("/")

# Fallback titles when a numbered file exists on disk but not in DB (local gap 15/22).
FALLBACK_TITLES: dict[str, tuple[str, str | None]] = {
    "15.pdf": ("LƯỢC GIẢNG KINH LĂNG NGHIÊM", None),
    "22.pdf": ("LƯỢC GIẢNG TÍN TÂM MINH TỊCH NGHĨA GIẢI", None),
}

FALLBACK_SLUGS: dict[str, str] = {
    "15.pdf": "luoc-giang-kinh-lang-nghiem-pdf",
    "22.pdf": "luoc-giang-tin-tam-minh-tich-nghia-giai-pdf",
}


def slugify(text: str) -> str:
    s = unicodedata.normalize("NFD", text)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80]


def title_case_vi(text: str) -> str:
    """ALL CAPS / mixed → Title Case (giữ dấu tiếng Việt)."""
    text = text.replace("·", "-").replace("—", "-").replace("–", "-")

    def fix_token(token: str) -> str:
        m = re.match(r"^([^\w]*)(.*?)([^\w]*)$", token, flags=re.UNICODE)
        if not m:
            return token
        lead, core, trail = m.group(1), m.group(2), m.group(3)
        if not core:
            return token
        upper = core.upper()
        if upper in {"XXI", "XX", "XIII", "XIV", "XV"} or re.fullmatch(
            r"[IVXLCDM]+", upper
        ):
            return f"{lead}{upper}{trail}"
        lower = core.lower()
        return f"{lead}{lower[:1].upper()}{lower[1:]}{trail}"

    parts: list[str] = []
    for word in re.split(r"(\s+|-)", text.strip()):
        if not word or word.isspace() or word == "-":
            parts.append(word)
        else:
            parts.append(fix_token(word))
    return "".join(parts)


def safe_filename(title: str, volume: str | None) -> str:
    base = title_case_vi(title.strip())
    # Nếu title chưa chứa volume (local 13/14), gắn thêm
    vol = (volume or "").strip()
    if vol:
        vol_tc = title_case_vi(vol)
        # Tránh lặp "Quyển Hạ" nếu title đã chứa
        if vol_tc.lower() not in base.lower() and "quyển" in vol_tc.lower():
            base = f"{base} - {vol_tc}"
    base = re.sub(r'[/\\:*?"<>|]+', "", base)
    base = re.sub(r"\s+", " ", base).strip(" .")
    if not base.lower().endswith(".pdf"):
        base = f"{base}.pdf"
    return base


def run_psql(psql_prefix: str, sql: str) -> str:
    cmd = psql_prefix.split() + ["-v", "ON_ERROR_STOP=1", "-At", "-F", "\t", "-c", sql]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"psql failed:\n{r.stderr or r.stdout}")
    return r.stdout


def fetch_rows(psql_prefix: str) -> list[dict]:
    sql = """
SELECT id::text, filename, title, COALESCE(volume, ''), slug, sort_order::text
FROM pdf_files
ORDER BY sort_order, filename;
"""
    out = run_psql(psql_prefix, sql)
    rows = []
    for line in out.splitlines():
        if not line.strip():
            continue
        id_, filename, title, volume, slug, sort_order = line.split("\t")
        rows.append(
            {
                "id": id_,
                "filename": filename,
                "title": title,
                "volume": volume or None,
                "slug": slug,
                "sort_order": int(sort_order),
            }
        )
    return rows


def esc(s: str) -> str:
    return s.replace("'", "''")


def ensure_missing_rows(psql_prefix: str, pdf_dir: Path, dry_run: bool) -> None:
    """Insert 15/22 if file exists on disk but row missing."""
    existing = {r["filename"] for r in fetch_rows(psql_prefix)}
    # also match by sort_order later; here only numbered orphans
    for old_name, (title, volume) in FALLBACK_TITLES.items():
        if old_name in existing:
            continue
        path = pdf_dir / old_name
        if not path.is_file():
            continue
        slug = FALLBACK_SLUGS[old_name]
        sort_order = int(Path(old_name).stem)
        size = path.stat().st_size
        storage = f"pdf/{old_name}"
        url = f"{PUBLIC_BASE}/files/{storage}"
        sql = f"""
INSERT INTO pdf_files (
  slug, title, volume, author, filename, folder_path, storage_path, public_url,
  file_size_bytes, sort_order
) VALUES (
  '{esc(slug)}',
  '{esc(title)}',
  {f"'{esc(volume)}'" if volume else "NULL"},
  'Hòa thượng Thích Duy Lực',
  '{esc(old_name)}', 'pdf/', '{esc(storage)}',
  '{esc(url)}',
  {size}, {sort_order}
)
ON CONFLICT (storage_path) DO NOTHING;
"""
        print(f"  + insert missing row for {old_name} ({title})")
        if not dry_run:
            run_psql(psql_prefix, sql)


def unique_target(name: str, used: set[str]) -> str:
    if name not in used:
        used.add(name)
        return name
    stem = name[:-4] if name.lower().endswith(".pdf") else name
    n = 2
    while True:
        cand = f"{stem} ({n}).pdf"
        if cand not in used:
            used.add(cand)
            return cand
        n += 1


def rename_one(
    pdf_dir: Path,
    row: dict,
    new_name: str,
    dry_run: bool,
    psql_prefix: str,
) -> None:
    old_name = row["filename"]
    if old_name == new_name:
        print(f"  = keep {old_name}")
        return

    src = pdf_dir / old_name
    dst = pdf_dir / new_name
    # Nếu đã rename file trước đó nhưng DB chưa kịp
    if not src.is_file() and dst.is_file():
        print(f"  ~ file already {new_name}; update DB only ({old_name})")
    elif not src.is_file():
        # thử theo số sort_order
        alt = pdf_dir / f"{row['sort_order']}.pdf"
        if alt.is_file() and old_name != alt.name:
            src = alt
            print(f"  ! using on-disk {alt.name} for row {old_name}")
        else:
            print(f"  x missing file for {old_name} → skip file rename, update DB if dst exists")
            if not dst.is_file() and not dry_run:
                print(f"    ERROR: neither {old_name} nor {new_name} on disk")
                return

    storage = f"pdf/{new_name}"
    # Encode path segments for URL safety (spaces / unicode)
    from urllib.parse import quote

    public_url = f"{PUBLIC_BASE}/files/pdf/{quote(new_name)}"

    print(f"  {old_name}  →  {new_name}")
    if dry_run:
        return

    if src.is_file() and src.resolve() != dst.resolve():
        if dst.exists():
            raise FileExistsError(f"Target exists: {dst}")
        src.rename(dst)

    size = dst.stat().st_size if dst.is_file() else "NULL"
    sql = f"""
UPDATE pdf_files SET
  filename = '{esc(new_name)}',
  storage_path = '{esc(storage)}',
  public_url = '{esc(public_url)}',
  file_size_bytes = {size if size != "NULL" else "file_size_bytes"}
WHERE id = '{row["id"]}'::uuid;
"""
    run_psql(psql_prefix, sql)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf-dir", type=Path, default=DEFAULT_PDF_DIR)
    ap.add_argument(
        "--psql",
        default="docker exec -i tosu_db psql -U tosuthien -d tosuthien",
        help="Command prefix to run psql (no -c)",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    pdf_dir: Path = args.pdf_dir
    if not pdf_dir.is_dir():
        print(f"PDF dir not found: {pdf_dir}", file=sys.stderr)
        return 1

    print(f"PDF dir: {pdf_dir}")
    print(f"psql:    {args.psql}")
    if args.dry_run:
        print("DRY RUN — no changes")

    ensure_missing_rows(args.psql, pdf_dir, args.dry_run)
    rows = fetch_rows(args.psql)
    if not rows:
        print("No pdf_files rows", file=sys.stderr)
        return 1

    used: set[str] = set()
    plan: list[tuple[dict, str]] = []
    for row in rows:
        name = safe_filename(row["title"], row["volume"])
        name = unique_target(name, used)
        plan.append((row, name))

    print(f"\nRenaming {len(plan)} PDFs…")
    for row, name in plan:
        rename_one(pdf_dir, row, name, args.dry_run, args.psql)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
