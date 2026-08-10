#!/usr/bin/env python3
"""Point post HTML/cover URLs at full-size PNG when a WP-style -WxH variant was stored."""

from __future__ import annotations

import argparse
import os
import re
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
SIZE_IN_NAME = re.compile(r"^(.+)-(\d+)x(\d+)$", re.IGNORECASE)
URL_SIZE = re.compile(
    r"(-\d+x\d+)(\.(?:png|jpe?g|webp|gif))",
    re.IGNORECASE,
)


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
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip().strip("'\"")
    values.update(os.environ)
    return values


def data_root_from_env(env: dict[str, str]) -> Path:
    raw = env.get("DATA_ROOT", str(ROOT / "data"))
    p = Path(raw)
    if not p.is_absolute():
        p = (ROOT / "nestjs" / p).resolve()
    return p


def pick_best_file(post_dir: Path, stem: str) -> Path | None:
    full = post_dir / f"{stem}.png"
    if full.is_file() and full.stat().st_size > 0:
        return full
    best: Path | None = None
    best_pixels = 0
    for candidate in post_dir.glob(f"{stem}-*.png"):
        m = SIZE_IN_NAME.match(candidate.stem)
        if not m or m.group(1) != stem:
            continue
        w, h = int(m.group(2)), int(m.group(3))
        px = w * h
        if px > best_pixels:
            best_pixels = px
            best = candidate
    return best


def upgrade_url(url: str, posts_root: Path) -> str:
    if not url or "/files/images/posts/" not in url:
        return url
    path_part = url.split("/files/images/posts/", 1)[-1].split("?", 1)[0]
    if "/" not in path_part:
        return strip_size_from_url(url)
    wp_id, filename = path_part.split("/", 1)
    post_dir = posts_root / wp_id
    if not post_dir.is_dir():
        return strip_size_from_url(url)

    stem = Path(filename).stem
    m = SIZE_IN_NAME.match(stem)
    base_stem = m.group(1) if m else stem
    best = pick_best_file(post_dir, base_stem)
    if not best:
        return strip_size_from_url(url)

    prefix = url.rsplit("/files/images/posts/", 1)[0]
    return f"{prefix}/files/images/posts/{wp_id}/{best.name}"


def strip_size_from_url(url: str) -> str:
    return URL_SIZE.sub(r"\2", url)


def upgrade_html(html: str, posts_root: Path) -> str:
    if not html:
        return html

    def repl(match: re.Match[str]) -> str:
        return upgrade_url(match.group(0), posts_root)

    out = re.sub(
        r"https?://[^\"'\s>]+/files/images/posts/[^\"'\s>]+\.(?:png|jpe?g|webp|gif)",
        repl,
        html,
        flags=re.IGNORECASE,
    )
    out = re.sub(r'\s(width|height)=["\'][^"\']*["\']', "", out, flags=re.IGNORECASE)
    out = re.sub(
        r'\sclass=["\'][^"\']*\bwp-image-\d+[^"\']*["\']',
        "",
        out,
        flags=re.IGNORECASE,
    )
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    env = load_env()
    db_url = env.get("DATABASE_URL")
    if not db_url:
        raise SystemExit("DATABASE_URL required")
    posts_root = data_root_from_env(env) / "images" / "posts"

    updated_posts = 0
    updated_images = 0

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, wp_source_id, content, cover_image_url FROM posts WHERE content IS NOT NULL OR cover_image_url IS NOT NULL"
            )
            rows = cur.fetchall()
            for post_id, wp_source_id, content, cover in rows:
                new_content = upgrade_html(content or "", posts_root)
                new_cover = (
                    upgrade_url(cover, posts_root) if cover else cover
                )
                if new_content != (content or "") or new_cover != cover:
                    if not args.dry_run:
                        cur.execute(
                            "UPDATE posts SET content = %s, cover_image_url = %s, updated_at = now() WHERE id = %s",
                            (new_content or None, new_cover, post_id),
                        )
                    updated_posts += 1

            cur.execute("SELECT id, url FROM post_images WHERE url IS NOT NULL")
            for img_id, url in cur.fetchall():
                new_url = upgrade_url(url, posts_root)
                if new_url != url:
                    if not args.dry_run:
                        cur.execute(
                            "UPDATE post_images SET url = %s WHERE id = %s",
                            (new_url, img_id),
                        )
                    updated_images += 1

        if not args.dry_run:
            conn.commit()

    mode = "DRY-RUN" if args.dry_run else "APPLY"
    print(f"{mode}: posts_updated={updated_posts} post_images_updated={updated_images}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
