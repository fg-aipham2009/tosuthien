#!/usr/bin/env python3
"""Import all posts in the WordPress "tin-tuc" category into PostgreSQL.

The importer is idempotent:
- categories and posts are upserted by WordPress source ID
- category links and post image rows are rebuilt for each imported post
- referenced wp-content images are downloaded under data/images/posts/<wp-id>/
- imported HTML is rewritten to the local /files/images/posts/... URLs
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import html
import json
import mimetypes
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import psycopg

ROOT = Path(__file__).resolve().parents[1]
WP_BASE = "https://tosuthien.com"
API = f"{WP_BASE}/wp-json/wp/v2"
UPLOAD_URL_RE = re.compile(
    r"https?://(?:www\.)?tosuthien\.com/wp-content/uploads/[^\"'<>\s,)]+",
    re.IGNORECASE,
)
SRCSET_RE = re.compile(r"\s(?:srcset|sizes)=(['\"]).*?\1", re.IGNORECASE | re.DOTALL)


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("'\"")
    return values


def request_json(url: str) -> tuple[Any, dict[str, str]]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "tosuthien-news-import/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        headers = {k.lower(): v for k, v in response.headers.items()}
        return json.load(response), headers


def fetch_all_posts(category_id: int) -> list[dict[str, Any]]:
    posts: list[dict[str, Any]] = []
    page = 1
    while True:
        query = urllib.parse.urlencode(
            {
                "categories": category_id,
                "per_page": 100,
                "page": page,
                "_embed": "1",
                "orderby": "date",
                "order": "asc",
            }
        )
        batch, headers = request_json(f"{API}/posts?{query}")
        posts.extend(batch)
        total_pages = int(headers.get("x-wp-totalpages", "1"))
        print(f"Fetched page {page}/{total_pages}: {len(batch)} posts", flush=True)
        if page >= total_pages:
            break
        page += 1
    return posts


def clean_rendered(value: dict[str, Any] | None) -> str:
    return (value or {}).get("rendered", "") or ""


def safe_name(url: str, used: set[str]) -> str:
    raw = Path(urllib.parse.unquote(urllib.parse.urlparse(url).path)).name
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", raw).strip("-") or "image.jpg"
    stem, suffix = os.path.splitext(name)
    candidate = name
    counter = 2
    while candidate.lower() in used:
        candidate = f"{stem}-{counter}{suffix}"
        counter += 1
    used.add(candidate.lower())
    return candidate


def encode_url(source_url: str) -> str:
    """Percent-encode non-ASCII path segments so urllib can request them."""
    parsed = urllib.parse.urlsplit(source_url.replace("http://", "https://"))
    path = urllib.parse.quote(urllib.parse.unquote(parsed.path), safe="/%:@&=+$,;")
    query = urllib.parse.quote(urllib.parse.unquote(parsed.query), safe="=&%:@+$,;")
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, query, parsed.fragment))


def download_image(source_url: str, target: Path) -> tuple[int | None, str | None]:
    if target.exists() and target.stat().st_size > 0:
        return target.stat().st_size, mimetypes.guess_type(target.name)[0]
    target.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(
        encode_url(source_url),
        headers={"User-Agent": "Mozilla/5.0 tosuthien-news-import/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            content = response.read()
            target.write_bytes(content)
            return len(content), response.headers.get_content_type()
    except (urllib.error.URLError, TimeoutError, OSError, UnicodeEncodeError) as exc:
        print(f"WARN image failed: {source_url}: {exc}", file=sys.stderr, flush=True)
        return None, None


def featured_media(post: dict[str, Any]) -> dict[str, Any] | None:
    embedded = post.get("_embedded") or {}
    items = embedded.get("wp:featuredmedia") or []
    return items[0] if items else None


def author_name(post: dict[str, Any]) -> str | None:
    authors = (post.get("_embedded") or {}).get("author") or []
    return authors[0].get("name") if authors else None


def image_metadata(media: dict[str, Any] | None) -> dict[str, Any]:
    empty = {
        "wp_source_id": None,
        "alt_text": None,
        "caption": None,
        "mime_type": None,
        "width": None,
        "height": None,
    }
    if not media:
        return empty
    details = media.get("media_details") or {}
    return {
        **empty,
        "wp_source_id": media.get("id"),
        "alt_text": media.get("alt_text") or None,
        "caption": re.sub(r"<[^>]+>", "", clean_rendered(media.get("caption"))).strip() or None,
        "mime_type": media.get("mime_type"),
        "width": details.get("width"),
        "height": details.get("height"),
    }


def import_post(
    conn: psycopg.Connection,
    post: dict[str, Any],
    category_ids: dict[int, str],
    data_root: Path,
    public_base: str,
) -> tuple[int, int]:
    wp_id = int(post["id"])
    post_dir = data_root / "images" / "posts" / str(wp_id)
    used_names: set[str] = set()
    content = clean_rendered(post.get("content"))
    excerpt = clean_rendered(post.get("excerpt"))
    media = featured_media(post)
    featured_url = (media or {}).get("source_url")
    if featured_url:
        featured_url = re.sub(
            r"-\d+x\d+(\.(?:jpe?g|png|webp|gif))", r"\1", featured_url, flags=re.I
        )

    source_urls: list[str] = []
    if featured_url:
        source_urls.append(featured_url)
    for source in UPLOAD_URL_RE.findall(content + "\n" + excerpt):
        source = html.unescape(source).rstrip(".")
        source = re.sub(r"-\d+x\d+(\.(?:jpe?g|png|webp|gif))", r"\1", source, flags=re.I)
        if source not in source_urls:
            source_urls.append(source)

    jobs: list[tuple[int, str, str, Path, dict[str, Any]]] = []
    for index, source in enumerate(source_urls):
        filename = safe_name(source, used_names)
        target = post_dir / filename
        jobs.append(
            (
                index,
                source,
                filename,
                target,
                image_metadata(media if source == featured_url else None),
            )
        )

    def fetch(job: tuple[int, str, str, Path, dict[str, Any]]):
        index, source, filename, target, metadata = job
        try:
            size, mime_type = download_image(source, target)
        except Exception as exc:  # noqa: BLE001 — keep import running
            print(f"WARN image failed: {source}: {exc}", file=sys.stderr, flush=True)
            size, mime_type = None, None
        return index, source, filename, metadata, size, mime_type

    workers = min(12, max(1, len(jobs)))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        downloaded = list(executor.map(fetch, jobs))

    replacements: dict[str, str] = {}
    image_rows: list[dict[str, Any]] = []
    for index, source, filename, metadata, size, mime_type in downloaded:
        if size is None:
            # Keep the source URL if the original cannot be downloaded.
            local_url = source.replace("http://", "https://")
        else:
            local_url = f"{public_base}/files/images/posts/{wp_id}/{filename}"
        replacements[source] = local_url
        image_rows.append(
            {
                **metadata,
                "role": "cover" if source == featured_url else "content",
                "source_url": source,
                "url": local_url,
                "mime_type": metadata.get("mime_type") or mime_type,
                "file_size": size,
                "sort_order": index,
            }
        )

    for source, local in replacements.items():
        content = content.replace(source, local).replace(source.replace("https://", "http://"), local)
        excerpt = excerpt.replace(source, local).replace(source.replace("https://", "http://"), local)
    content = SRCSET_RE.sub("", content)
    excerpt = SRCSET_RE.sub("", excerpt)

    yoast = post.get("yoast_head_json") or {}
    published_at = post.get("date_gmt") or post.get("date")
    updated_at = post.get("modified_gmt") or post.get("modified") or published_at
    cover_url = replacements.get(featured_url, featured_url) if featured_url else None

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO posts (
              wp_source_id, slug, title, excerpt, content, content_format,
              cover_image_url, source_url, author_name, seo_title, seo_description,
              published_at, is_pinned, is_published, created_at, updated_at
            )
            VALUES (
              %(wp_id)s, %(slug)s, %(title)s, %(excerpt)s, %(content)s, 'html',
              %(cover)s, %(source)s, %(author)s, %(seo_title)s, %(seo_description)s,
              %(published_at)s, %(sticky)s, true, %(published_at)s, %(updated_at)s
            )
            ON CONFLICT (wp_source_id) DO UPDATE SET
              slug = EXCLUDED.slug,
              title = EXCLUDED.title,
              excerpt = EXCLUDED.excerpt,
              content = EXCLUDED.content,
              content_format = EXCLUDED.content_format,
              cover_image_url = EXCLUDED.cover_image_url,
              source_url = EXCLUDED.source_url,
              author_name = EXCLUDED.author_name,
              seo_title = EXCLUDED.seo_title,
              seo_description = EXCLUDED.seo_description,
              published_at = EXCLUDED.published_at,
              is_pinned = EXCLUDED.is_pinned,
              is_published = true,
              updated_at = EXCLUDED.updated_at
            RETURNING id
            """,
            {
                "wp_id": wp_id,
                "slug": post["slug"],
                "title": html.unescape(clean_rendered(post.get("title"))),
                "excerpt": excerpt or None,
                "content": content or None,
                "cover": cover_url,
                "source": post.get("link"),
                "author": author_name(post),
                "seo_title": yoast.get("title"),
                "seo_description": yoast.get("description"),
                "published_at": published_at,
                "updated_at": updated_at,
                "sticky": bool(post.get("sticky")),
            },
        )
        post_id = cur.fetchone()[0]

        cur.execute("DELETE FROM post_category_links WHERE post_id = %s", (post_id,))
        for wp_category_id in post.get("categories") or []:
            category_id = category_ids.get(int(wp_category_id))
            if category_id:
                cur.execute(
                    """
                    INSERT INTO post_category_links (post_id, category_id)
                    VALUES (%s, %s) ON CONFLICT DO NOTHING
                    """,
                    (post_id, category_id),
                )

        cur.execute("DELETE FROM post_images WHERE post_id = %s", (post_id,))
        for row in image_rows:
            cur.execute(
                """
                INSERT INTO post_images (
                  post_id, wp_source_id, role, source_url, url, alt_text, caption,
                  mime_type, width, height, file_size, sort_order
                ) VALUES (
                  %(post_id)s, %(wp_source_id)s, %(role)s, %(source_url)s, %(url)s,
                  %(alt_text)s, %(caption)s, %(mime_type)s, %(width)s, %(height)s,
                  %(file_size)s, %(sort_order)s
                )
                """,
                {"post_id": post_id, **row},
            )
    return 1, len(image_rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--category-id", type=int, default=2)
    parser.add_argument("--skip-images", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument(
        "--public-base",
        help="Override PUBLIC_BASE_URL for stored image URLs (e.g. http://localhost:8000)",
    )
    args = parser.parse_args()

    env = {**load_env(ROOT / ".env.example"), **load_env(ROOT / ".env"), **os.environ}
    database_url = env.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")
    public_base = (
        args.public_base
        or env.get("IMPORT_PUBLIC_BASE_URL")
        or env.get("PUBLIC_BASE_URL")
        or "https://api.tosuthien.net"
    ).rstrip("/")
    data_root = Path(env.get("DATA_ROOT", str(ROOT / "data")))
    if not data_root.is_absolute():
        # DATA_ROOT=../data is defined relative to the NestJS working directory.
        data_root = (ROOT / "nestjs" / data_root).resolve()

    categories, _ = request_json(f"{API}/categories?per_page=100")
    posts = fetch_all_posts(args.category_id)
    if args.limit:
        posts = posts[: args.limit]
    used_category_ids = {int(cid) for post in posts for cid in (post.get("categories") or [])}

    if args.skip_images:
        global download_image
        download_image = lambda source, target: (None, None)  # type: ignore[assignment]

    category_map: dict[int, str] = {}
    total_images = 0
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for category in categories:
                wp_id = int(category["id"])
                if wp_id not in used_category_ids:
                    continue
                cur.execute(
                    """
                    INSERT INTO post_categories (
                      wp_source_id, slug, name, description, sort_order
                    ) VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (slug) DO UPDATE SET
                      wp_source_id = EXCLUDED.wp_source_id,
                      slug = EXCLUDED.slug,
                      name = EXCLUDED.name,
                      description = EXCLUDED.description,
                      updated_at = now()
                    RETURNING id
                    """,
                    (
                        wp_id,
                        category["slug"],
                        html.unescape(category["name"]),
                        category.get("description") or None,
                        wp_id,
                    ),
                )
                category_map[wp_id] = str(cur.fetchone()[0])
        conn.commit()

        for index, post in enumerate(posts, 1):
            _, image_count = import_post(conn, post, category_map, data_root, public_base)
            total_images += image_count
            conn.commit()
            print(
                f"[{index}/{len(posts)}] {post['id']} {post['slug']} ({image_count} images)",
                flush=True,
            )

    print(f"DONE: {len(posts)} posts, {len(category_map)} categories, {total_images} image links")


if __name__ == "__main__":
    main()
