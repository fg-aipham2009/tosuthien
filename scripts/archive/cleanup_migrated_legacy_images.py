#!/usr/bin/env python3
"""Remove legacy image files (jpg/jpeg/webp/gif) when a PNG twin already exists.

Safe for post/book PNG migration: only deletes if ``stem.png`` is present and non-empty.
Does not touch JPG-only files still referenced by the app (e.g. center gallery on disk).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

LEGACY = {".jpg", ".jpeg", ".webp", ".gif", ".JPG", ".JPEG", ".WEBP", ".GIF"}


def cleanup_dir(root: Path, dry_run: bool) -> tuple[int, int, int]:
    deleted = skipped = 0
    freed = 0
    if not root.is_dir():
        return 0, 0, 0
    for src in sorted(root.rglob("*")):
        if not src.is_file() or src.suffix not in LEGACY:
            continue
        dst = src.with_suffix(".png")
        if not dst.is_file() or dst.stat().st_size <= 0:
            skipped += 1
            continue
        size = src.stat().st_size
        if dry_run:
            print(f"  would delete {src} ({size} bytes, has {dst.name})")
        else:
            src.unlink(missing_ok=True)
        deleted += 1
        freed += size
    return deleted, skipped, freed


def cleanup_book_covers(books_root: Path, dry_run: bool) -> tuple[int, int]:
    deleted = freed = 0
    if not books_root.is_dir():
        return 0, 0
    cover_png = books_root / "cover.png"
    for book_dir in books_root.iterdir():
        if not book_dir.is_dir():
            continue
        png = book_dir / "cover.png"
        if not png.is_file() or png.stat().st_size <= 0:
            continue
        for name in ("cover.jpg", "cover.jpeg", "cover.webp", "cover.gif"):
            legacy = book_dir / name
            if not legacy.is_file():
                continue
            size = legacy.stat().st_size
            if dry_run:
                print(f"  would delete {legacy}")
            else:
                legacy.unlink(missing_ok=True)
            deleted += 1
            freed += size
    return deleted, freed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--data-root",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    data = args.data_root.resolve()
    images = data / "images"
    mode = "DRY-RUN" if args.dry_run else "APPLY"
    print(f"{mode} data-root={data}")

    total_del = total_freed = 0
    for sub in ("posts", "gallery"):
        d, s, f = cleanup_dir(images / sub, args.dry_run)
        print(f"  {sub}: deleted={d} skipped_no_png={s} freed={f/1024/1024:.2f} MiB")
        total_del += d
        total_freed += f

    bd, bf = cleanup_book_covers(images / "books", args.dry_run)
    print(f"  books covers: deleted={bd} freed={bf/1024/1024:.2f} MiB")
    total_del += bd
    total_freed += bf

    print(f"Total deleted={total_del} freed={total_freed/1024/1024:.2f} MiB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
