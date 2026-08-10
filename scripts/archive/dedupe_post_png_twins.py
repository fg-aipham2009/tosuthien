#!/usr/bin/env python3
"""Dedupe identical *-2.png siblings under posts/; rewrite DB URLs; delete dupes."""

from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path


ROOT = Path("/opt/tosu-thien/data/images/posts")
PUBLIC = "https://api.tosuthien.net/files/images/posts"
APPLY = "--apply" in sys.argv
for a in sys.argv[1:]:
    if a != "--apply" and not a.startswith("-"):
        ROOT = Path(a)
        break


def quick_hash(f: Path) -> bytes:
    m = hashlib.md5()
    with open(f, "rb") as fh:
        m.update(fh.read(65536))
        fh.seek(0, 2)
        m.update(str(fh.tell()).encode())
    return m.digest()


def esc(s: str) -> str:
    return s.replace("'", "''")


def main() -> int:
    pairs: list[tuple[str, str, Path]] = []
    for p in ROOT.rglob("*-2.png"):
        if not p.name.endswith("-2.png"):
            continue
        base = p.with_name(p.name[: -len("-2.png")] + ".png")
        if not base.is_file():
            continue
        if p.stat().st_size != base.stat().st_size:
            continue
        if quick_hash(p) != quick_hash(base):
            continue
        pairs.append((str(p.relative_to(ROOT)), str(base.relative_to(ROOT)), p))

    bytes_ = sum(p.stat().st_size for *_, p in pairs)
    print(f"pairs={len(pairs)} reclaim≈{bytes_ / 1e9:.2f}G apply={APPLY}")
    if not pairs:
        return 0

    sql_path = Path("/tmp/dedupe-post-2png.sql")
    with sql_path.open("w") as f:
        for rel2, rel1, _ in pairs:
            u2 = esc(f"{PUBLIC}/{rel2}")
            u1 = esc(f"{PUBLIC}/{rel1}")
            f.write(f"UPDATE post_images SET url = '{u1}' WHERE url = '{u2}';\n")
            f.write(
                f"UPDATE posts SET cover_image_url = '{u1}' WHERE cover_image_url = '{u2}';\n"
            )
            f.write(
                f"UPDATE posts SET content = replace(content, '{u2}', '{u1}') "
                f"WHERE content LIKE '%{u2}%';\n"
            )

    if not APPLY:
        print(f"wrote {sql_path} (dry-run; pass --apply)")
        return 0

    r = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "tosu_db",
            "psql",
            "-U",
            "tosuthien",
            "-d",
            "tosuthien",
            "-v",
            "ON_ERROR_STOP=1",
        ],
        input=sql_path.read_text(),
        text=True,
        capture_output=True,
    )
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        return 1
    print("db updated")

    deleted = 0
    for *_, p in pairs:
        try:
            p.unlink()
            deleted += 1
        except OSError as e:
            print(f"delete fail {p}: {e}", file=sys.stderr)
    print(f"deleted {deleted} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
