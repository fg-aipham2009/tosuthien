#!/usr/bin/env python3
"""Convert post images under data/images/posts to PNG and emit SQL for URL rewrites.

Usage on VPS (via tosu_api for sharp) OR local with Pillow:
  python3 scripts/convert_post_images_to_png.py --root /opt/tosu-thien/data/images/posts --dry-run
  python3 scripts/convert_post_images_to_png.py --root ... --apply

Converts .jpg/.jpeg/.webp/.gif → .png (same basename), deletes source after success.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


LEGACY_EXT = {".jpg", ".jpeg", ".webp", ".gif", ".JPG", ".JPEG", ".WEBP", ".GIF"}


def convert_with_pillow(src: Path, dst: Path) -> None:
    from PIL import Image

    with Image.open(src) as im:
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
        else:
            im = im.convert("RGB")
        im.save(dst, format="PNG", optimize=True)


def convert_with_sharp_docker(src: Path, dst: Path) -> None:
    """Use sharp inside tosu_api container (src/dst must be under /opt/tosu-thien/data)."""
    src_c = str(src).replace("/opt/tosu-thien/data", "/data", 1)
    dst_c = str(dst).replace("/opt/tosu-thien/data", "/data", 1)
    js = (
        "const sharp=require('sharp');const fs=require('fs');"
        f"sharp({src_c!r}).rotate().png({{compressionLevel:9}}).toFile({dst_c!r})"
        ".then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"
    )
    r = subprocess.run(
        ["docker", "exec", "tosu_api", "node", "-e", js],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout or "sharp failed")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "images" / "posts",
    )
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--engine",
        choices=("auto", "pillow", "sharp-docker"),
        default="auto",
    )
    ap.add_argument(
        "--min-free-mb",
        type=int,
        default=800,
        help="Stop if free disk under this many MiB (default 800)",
    )
    args = ap.parse_args()
    root: Path = args.root
    if not root.is_dir():
        print(f"Not found: {root}", file=sys.stderr)
        return 1

    engine = args.engine
    if engine == "auto":
        try:
            import PIL  # noqa: F401

            engine = "pillow"
        except ImportError:
            engine = "sharp-docker"
    print(f"engine={engine} root={root}")

    files = sorted(
        p
        for p in root.rglob("*")
        if p.is_file() and p.suffix in LEGACY_EXT
    )
    print(f"to convert: {len(files)}")

    ok = skip = fail = 0
    for i, src in enumerate(files, 1):
        dst = src.with_suffix(".png")
        if dst.is_file() and dst.stat().st_size > 0:
            # Already have png — drop legacy
            if not args.dry_run:
                src.unlink(missing_ok=True)
            skip += 1
            continue

        # Disk guard
        st = os.statvfs(root)
        free_mb = (st.f_bavail * st.f_frsize) / (1024 * 1024)
        if free_mb < args.min_free_mb:
            print(
                f"STOP: only {free_mb:.0f} MiB free (< {args.min_free_mb}). "
                f"Converted {ok}, skipped {skip}, failed {fail}, remaining {len(files)-i+1}",
                file=sys.stderr,
            )
            return 2

        if args.dry_run:
            print(f"  would {src.relative_to(root)} → {dst.name}")
            ok += 1
            continue

        try:
            if engine == "pillow":
                convert_with_pillow(src, dst)
            else:
                convert_with_sharp_docker(src, dst)
            src.unlink(missing_ok=True)
            ok += 1
            if i % 50 == 0 or i == len(files):
                print(f"  [{i}/{len(files)}] ok={ok} skip={skip} fail={fail} free={free_mb:.0f}MiB")
        except Exception as e:
            fail += 1
            print(f"  FAIL {src}: {e}", file=sys.stderr)
            if dst.is_file() and dst.stat().st_size == 0:
                dst.unlink(missing_ok=True)

    print(f"\nDone ok={ok} skip={skip} fail={fail}")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
