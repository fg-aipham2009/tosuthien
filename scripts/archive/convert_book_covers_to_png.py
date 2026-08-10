#!/usr/bin/env python3
"""Convert book covers under data/images/books/*/cover.* → cover.png and print SQL updates.

Usage:
  python3 scripts/convert_book_covers_to_png.py [--root data/images/books] [--apply-sql via docker]
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from PIL import Image


LEGACY = (".jpg", ".jpeg", ".webp", ".gif", ".JPG", ".JPEG", ".WEBP", ".GIF")


def convert_dir(book_dir: Path) -> Path | None:
    png = book_dir / "cover.png"
    # Prefer converting from non-png if present; else keep existing png
    sources = [book_dir / f"cover{ext}" for ext in LEGACY]
    sources = [p for p in sources if p.is_file()]

    if sources:
        src = sources[0]
        with Image.open(src) as im:
            im = im.convert("RGB")
            im.save(png, format="PNG", optimize=True)
        for p in sources:
            if p.resolve() != png.resolve():
                p.unlink(missing_ok=True)
        return png

    if png.is_file():
        return png
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "images" / "books",
    )
    ap.add_argument(
        "--public-base",
        default="https://api.tosuthien.net",
        help="Public API base for cover_image_url",
    )
    ap.add_argument(
        "--psql",
        default="",
        help='Optional psql prefix, e.g. docker exec -i tosu_db psql -U tosuthien -d tosuthien',
    )
    args = ap.parse_args()

    root: Path = args.root
    if not root.is_dir():
        print(f"Not found: {root}", file=sys.stderr)
        return 1

    updated: list[tuple[str, str]] = []
    for book_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        out = convert_dir(book_dir)
        if not out:
            print(f"  skip {book_dir.name}: no cover")
            continue
        url = f"{args.public_base.rstrip('/')}/files/images/books/{book_dir.name}/cover.png"
        updated.append((book_dir.name, url))
        print(f"  ok {book_dir.name} → cover.png")

    print(f"\nConverted/ensured {len(updated)} covers")

    if not args.psql:
        return 0

    for book_id, url in updated:
        sql = (
            "UPDATE pdf_files SET cover_image_url = "
            f"'{url.replace(chr(39), chr(39)+chr(39))}' "
            f"WHERE id = '{book_id}'::uuid;"
        )
        cmd = args.psql.split() + ["-v", "ON_ERROR_STOP=1", "-c", sql]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(f"SQL fail {book_id}: {r.stderr}", file=sys.stderr)
            return 1
    print("Database cover_image_url updated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
