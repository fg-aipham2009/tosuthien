#!/usr/bin/env python3
"""Generate list WebP thumbs for tin tức cards.

Creates:
  posts/*/cover.png          → cover-thumb.webp
  teachers/*/photo.png       → photo-thumb.webp
  any other image path       → sibling .list.webp (from DB cover_image_url)

Keeps list cards ~50–120KB instead of 1–3MB PNG.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


def load_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for name in (".env.example", ".env"):
        path = ROOT / name
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip("\"'")
    return values


def data_root(env: dict[str, str], override: Path | None) -> Path:
    if override:
        return override
    raw = env.get("DATA_ROOT")
    if raw:
        return Path(raw).expanduser()
    return ROOT / "data"


def make_thumb(src: Path, dest: Path, max_side: int, quality: int) -> None:
    from PIL import Image

    with Image.open(src) as im:
        im = im.convert("RGB")
        im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "WEBP", quality=quality, method=6)


def thumb_path_for(src: Path) -> Path:
    name = src.name.lower()
    if name == "cover.png" or re.fullmatch(r"cover\.(png|jpe?g|webp|gif)", name):
        return src.with_name("cover-thumb.webp")
    if name == "photo.png" or re.fullmatch(r"photo\.(png|jpe?g|webp|gif)", name):
        return src.with_name("photo-thumb.webp")
    return src.with_name(src.stem + ".list.webp")


def url_to_local(url: str, files_root: Path) -> Path | None:
    if not url:
        return None
    path = urlparse(url).path
    marker = "/files/"
    idx = path.find(marker)
    if idx < 0:
        return None
    rel = path[idx + len(marker) :]
    local = files_root / rel
    return local if local.is_file() else None


def collect_targets(files_root: Path, database_url: str | None) -> list[Path]:
    targets: set[Path] = set()
    posts = files_root / "images" / "posts"
    teachers = files_root / "images" / "teachers"
    if posts.is_dir():
        targets.update(posts.glob("*/cover.png"))
    if teachers.is_dir():
        targets.update(teachers.glob("*/photo.png"))

    if database_url:
        try:
            import psycopg

            with psycopg.connect(database_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT DISTINCT cover_image_url
                        FROM posts
                        WHERE cover_image_url IS NOT NULL
                          AND trim(cover_image_url) <> ''
                          AND coalesce(is_deleted, false) = false
                        """
                    )
                    for (url,) in cur.fetchall():
                        local = url_to_local(str(url), files_root)
                        if local:
                            targets.add(local)
        except Exception as exc:  # noqa: BLE001
            print(f"warn: skip DB cover list ({exc})", file=sys.stderr)

    return sorted(targets)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=Path, default=None)
    parser.add_argument("--max-side", type=int, default=720)
    parser.add_argument("--quality", type=int, default=78)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        print("Need Pillow: pip install pillow", file=sys.stderr)
        return 1

    env = load_env()
    root = data_root(env, args.data_root)
    files_root = root  # DATA_ROOT already points at .../data (files live under images/)
    # Public URLs are /files/images/... → local DATA_ROOT/images/...
    db_url = env.get("DATABASE_URL") or os.environ.get("DATABASE_URL")

    targets = collect_targets(files_root, db_url)
    made = skipped = errors = 0
    for src in targets:
        dest = thumb_path_for(src)
        if (
            not args.force
            and dest.is_file()
            and dest.stat().st_mtime >= src.stat().st_mtime
        ):
            skipped += 1
            continue
        if args.dry_run:
            print(f"WOULD {src} -> {dest}")
            made += 1
            continue
        try:
            make_thumb(src, dest, args.max_side, args.quality)
            print(f"OK {dest} ({dest.stat().st_size // 1024}KB)")
            made += 1
        except Exception as exc:  # noqa: BLE001
            print(f"ERR {src}: {exc}", file=sys.stderr)
            errors += 1

    print(f"done made={made} skipped={skipped} errors={errors} total={len(targets)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
