#!/usr/bin/env python3
"""Rename Sư Phụ Giảng Kinh folders + titles via HHTech, then rewrite disk paths.

Uses the same Tổ Sư Thiền diacritic-restore role as CD Vấn Đáp.
Skips folders whose names end with ' - Copy'.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")

HHTECH_BASE_URL = os.environ.get("HHTECH_BASE_URL", "https://hhtechapi.com/v1").rstrip("/")
HHTECH_API_KEY = os.environ.get("HHTECH_API_KEY", "")
DEFAULT_MODEL = os.environ.get("HHTECH_CHAT_MODEL", "claude-opus-4-6")

OLD_ROOT = "Su Phu Giang KInh"
NEW_ROOT = "Sư Phụ Giảng Kinh"
ALBUM_DIR = BASE_DIR / "data" / "mp3" / OLD_ROOT
NEW_ALBUM_DIR = BASE_DIR / "data" / "mp3" / NEW_ROOT

OUT_FOLDERS = BASE_DIR / "data" / "backups" / "su-phu-giang-kinh-folders-ai.json"
OUT_TITLES = BASE_DIR / "data" / "backups" / "su-phu-giang-kinh-titles-ai.json"
OUT_PLAN = BASE_DIR / "data" / "backups" / "su-phu-giang-kinh-rename-plan.json"
OUT_SQL = BASE_DIR / "data" / "backups" / "seed-mp3-su-phu-giang-kinh.sql"
PUBLIC_BASE = "https://api.tosuthien.net/files/mp3"
SLUG = "su-phu-giang-kinh"

FOLDER_SYSTEM = """You restore Vietnamese diacritics and clean Tổ Sư Thiền MP3 folder names.
Input: JSON object {old_folder_name: null}.
Output: ONLY a JSON object {old_folder_name: new_folder_name}.

Rules:
- Keep leading numeric prefix when present (01_, 02_, …) exactly.
- Restore proper Vietnamese diacritics (Tổ Sư Thiền, Lăng Nghiêm, Tín Tâm Minh, Pháp Bảo Đàn, v.v.).
- Expand clear abbreviations: SP→Sư phụ, HT→Hòa thượng, TST→Tổ Sư Thiền, PP→Phật pháp, Kh Hoc→Khoa học.
- Remove junk markers: @, @@@@, _M, trailing underscores, redundant (MP3)/(CD)/(mp3) tags.
- Keep useful metadata in parentheses when meaningful (e.g. số mục, tiếng Quảng).
- Do not invent content; only restore diacritics / clean obvious ascii/OCR mess.
- Folder name must be a valid single path segment (no / \\ : * ? \" < > |).
- Keep names concise and readable.
"""

TITLE_SYSTEM = """You restore Vietnamese diacritics for Tổ Sư Thiền MP3 titles.
Input: JSON object {ascii_stem: null}.
Output: ONLY a JSON object {ascii_stem: vietnamese_title}.

Rules:
- Restore proper Vietnamese diacritics for Buddhist Zen terms (Tổ Sư Thiền, Lăng Nghiêm, Tín Tâm Minh, v.v.).
- Expand common abbreviations when clear: SP→Sư phụ, HT→Hòa thượng, TST→Tổ Sư Thiền, PP→Phật pháp, Kh Hoc→Khoa học.
- Do not invent content; only restore diacritics / fix obvious OCR-style ascii.
- Keep useful numbers/codes at the start when present.
- Strip trailing junk like @, @@@@, lone underscores.
- Title is display text (may contain spaces); do not include .mp3.
"""

UNSAFE_FS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def safe_fs_name(name: str) -> str:
    cleaned = UNSAFE_FS.sub("_", name).strip().rstrip(".")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned or "untitled"


def list_folders() -> list[Path]:
    if not ALBUM_DIR.is_dir() and NEW_ALBUM_DIR.is_dir():
        return sorted(
            [
                p
                for p in NEW_ALBUM_DIR.iterdir()
                if p.is_dir() and not p.name.endswith(" - Copy")
            ],
            key=lambda p: p.name.lower(),
        )
    return sorted(
        [
            p
            for p in ALBUM_DIR.iterdir()
            if p.is_dir() and not p.name.endswith(" - Copy")
        ],
        key=lambda p: p.name.lower(),
    )


def list_tracks(folders: list[Path]) -> list[dict]:
    tracks: list[dict] = []
    for folder in folders:
        files = sorted(folder.glob("*.mp3"), key=lambda p: p.name.lower())
        for i, path in enumerate(files):
            tracks.append(
                {
                    "stem": path.stem,
                    "filename": path.name,
                    "folder_old": folder.name,
                    "abs": str(path),
                    "file_size_bytes": path.stat().st_size,
                    "local_sort": i,
                }
            )
    return tracks


def parse_json_object(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        raise ValueError(f"No JSON object in response: {text[:200]}")
    return json.loads(text[start : end + 1])


def chat_batch(system: str, keys: list[str], model: str, user_prefix: str) -> dict[str, str]:
    payload = {k: None for k in keys}
    body = {
        "model": model,
        "max_tokens": 8192,
        "temperature": 0.1,
        "messages": [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": f"{user_prefix}\n" + json.dumps(payload, ensure_ascii=False),
            },
        ],
    }
    req = urllib.request.Request(
        f"{HHTECH_BASE_URL}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {HHTECH_API_KEY}",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read())
    content = data["choices"][0]["message"]["content"]
    parsed = parse_json_object(content)
    out: dict[str, str] = {}
    for key in keys:
        val = parsed.get(key)
        if isinstance(val, str) and val.strip():
            out[key] = val.strip()
    return out


def load_json(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def run_batches(
    system: str,
    keys: list[str],
    mapping: dict[str, str],
    out_path: Path,
    model: str,
    batch_size: int,
    user_prefix: str,
    fallback_fn,
) -> dict[str, str]:
    pending = [k for k in keys if k not in mapping]
    print(f"pending={len(pending)} done={len(mapping)} model={model}")
    for i in range(0, len(pending), batch_size):
        chunk = pending[i : i + batch_size]
        attempt = 0
        while True:
            attempt += 1
            try:
                got = chat_batch(system, chunk, model, user_prefix)
                mapping.update(got)
                for k in chunk:
                    mapping.setdefault(k, fallback_fn(k))
                save_json(out_path, mapping)
                print(
                    f"batch {i // batch_size + 1}: +{len(got)}/{len(chunk)} total={len(mapping)}"
                )
                break
            except Exception as exc:  # noqa: BLE001
                wait = min(60, 5 * attempt)
                print(f"retry {attempt} after error: {exc}; sleep {wait}s")
                time.sleep(wait)
                if attempt >= 8:
                    for k in chunk:
                        mapping.setdefault(k, fallback_fn(k))
                    save_json(out_path, mapping)
                    print("giving up batch; used fallbacks")
                    break
        time.sleep(0.4)
    return mapping


def folder_fallback(name: str) -> str:
    n = name
    n = re.sub(r"(?i)\((?:mp3|cd)\)_?", "", n)
    n = re.sub(r"_+", " ", n)
    n = re.sub(r"@+", "", n)
    n = re.sub(r"\s+", " ", n).strip(" _")
    return safe_fs_name(n)


def title_fallback(stem: str) -> str:
    t = stem.replace("_", " ")
    t = re.sub(r"@+", "", t)
    t = re.sub(r"\s+", " ", t).strip(" .")
    return t or stem


def unique_name(desired: str, used: set[str]) -> str:
    base = safe_fs_name(desired)
    if base not in used:
        used.add(base)
        return base
    i = 2
    while f"{base} ({i})" in used:
        i += 1
    name = f"{base} ({i})"
    used.add(name)
    return name


def apply_disk_renames(folder_map: dict[str, str], title_map: dict[str, str], dry_run: bool) -> list[dict]:
    """Rename folders + files under album; move root to NEW_ROOT. Returns track rows for SQL."""
    src_root = ALBUM_DIR if ALBUM_DIR.is_dir() else NEW_ALBUM_DIR
    if not src_root.is_dir():
        raise SystemExit(f"Missing album dir: {ALBUM_DIR} / {NEW_ALBUM_DIR}")

    # Stage into NEW_ROOT (may equal src after move)
    if src_root.resolve() != NEW_ALBUM_DIR.resolve():
        if NEW_ALBUM_DIR.exists():
            raise SystemExit(f"Target already exists: {NEW_ALBUM_DIR}")
        print(f"move root: {src_root.name} -> {NEW_ROOT}")
        if not dry_run:
            src_root.rename(NEW_ALBUM_DIR)
        root = NEW_ALBUM_DIR if not dry_run else src_root
    else:
        root = NEW_ALBUM_DIR

    folders = sorted(
        [p for p in (root if not dry_run else src_root).iterdir() if p.is_dir() and not p.name.endswith(" - Copy")],
        key=lambda p: p.name.lower(),
    ) if (root if not dry_run else src_root).exists() else []

    if dry_run:
        folders = list_folders()

    used_folder_names: set[str] = set()
    rename_pairs: list[tuple[Path, str]] = []
    for folder in folders:
        desired = folder_map.get(folder.name) or folder_fallback(folder.name)
        new_name = unique_name(desired, used_folder_names)
        rename_pairs.append((folder, new_name))

    # Rename folders (deepest-safe: siblings only)
    folder_old_to_new: dict[str, str] = {}
    for folder, new_name in rename_pairs:
        folder_old_to_new[folder.name] = new_name
        if folder.name == new_name:
            continue
        dest = folder.parent / new_name
        print(f"folder: {folder.name} -> {new_name}")
        if not dry_run:
            if dest.exists():
                raise SystemExit(f"Folder collision: {dest}")
            folder.rename(dest)

    # Reload folders after rename
    live_root = NEW_ALBUM_DIR if (not dry_run and NEW_ALBUM_DIR.is_dir()) else (root if root.exists() else src_root)
    live_folders = {
        p.name: p
        for p in live_root.iterdir()
        if p.is_dir() and not p.name.endswith(" - Copy")
    } if live_root.exists() else {}

    rows: list[dict] = []
    sort_order = 0
    for old_name, new_name in sorted(folder_old_to_new.items(), key=lambda x: x[1].lower()):
        folder = live_folders.get(new_name)
        if folder is None and dry_run:
            # dry-run: use old path
            folder = next((f for f in folders if f.name == old_name), None)
        if folder is None:
            continue
        files = sorted(folder.glob("*.mp3"), key=lambda p: p.name.lower())
        used_files: set[str] = set()
        for i, path in enumerate(files):
            title = title_map.get(path.stem) or title_fallback(path.stem)
            # Keep original filename on disk (ASCII-safe); only folder/root renamed.
            # Titles go to DB for display — same pattern as CD Vấn Đáp.
            filename = path.name
            folder_path = f"{NEW_ROOT}/{new_name}/"
            storage = f"{NEW_ROOT}/{new_name}/{filename}"
            rows.append(
                {
                    "title": title,
                    "folder_path": folder_path,
                    "filename": filename,
                    "storage_path": storage,
                    "file_size_bytes": path.stat().st_size,
                    "sort_order": sort_order,
                }
            )
            sort_order += 1
            used_files.add(filename)

    plan = {
        "root_old": OLD_ROOT,
        "root_new": NEW_ROOT,
        "folders": folder_old_to_new,
        "tracks": len(rows),
    }
    save_json(OUT_PLAN, plan)
    print(f"wrote {OUT_PLAN} tracks={len(rows)}")
    return rows


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def public_url(storage_path: str) -> str:
    enc = "/".join(urllib.parse.quote(p, safe="") for p in storage_path.split("/"))
    return f"{PUBLIC_BASE}/{enc}"


def write_sql(rows: list[dict]) -> None:
    lines = [
        "-- Seed MP3: Sư Phụ Giảng Kinh — Vietnamese folders + HHTech titles",
        "BEGIN;",
        "",
        "INSERT INTO media_categories (slug, name, description, sort_order)",
        f"VALUES ('{SLUG}', '{sql_escape(NEW_ROOT)}', 'Sư Phụ giảng kinh / khai thị', 3)",
        "ON CONFLICT (slug) DO UPDATE SET",
        "  name = EXCLUDED.name,",
        "  description = EXCLUDED.description,",
        "  sort_order = EXCLUDED.sort_order;",
        "",
        "DELETE FROM mp3_tracks",
        f"WHERE category_id = (SELECT id FROM media_categories WHERE slug = '{SLUG}');",
        "",
    ]
    batch: list[str] = []
    for r in rows:
        batch.append(
            f"  ((SELECT id FROM media_categories WHERE slug = '{SLUG}'), "
            f"'{sql_escape(r['title'])}', 1990, NULL, NULL, "
            f"'{sql_escape(r['folder_path'])}', '{sql_escape(r['filename'])}', "
            f"'{sql_escape(r['storage_path'])}', '{sql_escape(public_url(r['storage_path']))}', "
            f"{r['file_size_bytes']}, {r['sort_order']}, true)"
        )
        if len(batch) >= 40:
            lines.append(
                "INSERT INTO mp3_tracks (\n"
                "  category_id, title, year, recorded_at, location,\n"
                "  folder_path, filename, storage_path, public_url,\n"
                "  file_size_bytes, sort_order, is_published\n"
                ") VALUES\n" + ",\n".join(batch) + ";"
            )
            lines.append("")
            batch = []
    if batch:
        lines.append(
            "INSERT INTO mp3_tracks (\n"
            "  category_id, title, year, recorded_at, location,\n"
            "  folder_path, filename, storage_path, public_url,\n"
            "  file_size_bytes, sort_order, is_published\n"
            ") VALUES\n" + ",\n".join(batch) + ";"
        )
        lines.append("")
    lines.append("COMMIT;")
    lines.append("")
    OUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUT_SQL}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--batch-size", type=int, default=20)
    ap.add_argument("--ai-only", action="store_true", help="Only call HHTech, no disk rename")
    ap.add_argument("--apply-only", action="store_true", help="Apply existing JSON maps to disk")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    folders = list_folders()
    folder_names = [f.name for f in folders]
    tracks = list_tracks(folders)
    print(f"folders={len(folder_names)} tracks={len(tracks)} root={folders[0].parent if folders else '?'}")

    folder_map = load_json(OUT_FOLDERS)
    title_map = load_json(OUT_TITLES)

    if not args.apply_only:
        if not HHTECH_API_KEY:
            raise SystemExit("Missing HHTECH_API_KEY")
        folder_map = run_batches(
            FOLDER_SYSTEM,
            folder_names,
            folder_map,
            OUT_FOLDERS,
            args.model,
            min(args.batch_size, 15),
            "Restore folder names:",
            folder_fallback,
        )
        for name in folder_names:
            folder_map[name] = safe_fs_name(folder_map.get(name) or folder_fallback(name))
        save_json(OUT_FOLDERS, folder_map)

        stems = [t["stem"] for t in tracks]
        title_map = run_batches(
            TITLE_SYSTEM,
            stems,
            title_map,
            OUT_TITLES,
            args.model,
            args.batch_size,
            "Restore titles:",
            title_fallback,
        )
        for stem in stems:
            title_map.setdefault(stem, title_fallback(stem))
        save_json(OUT_TITLES, title_map)

        print("sample folders:")
        for k in folder_names[:5]:
            print(f"  {k} -> {folder_map[k]}")
        print("sample titles:")
        for t in tracks[:5]:
            print(f"  {t['stem']} -> {title_map[t['stem']]}")

    if args.ai_only:
        return

    rows = apply_disk_renames(folder_map, title_map, dry_run=args.dry_run)
    write_sql(rows)
    for r in rows[:5]:
        print(" sample row:", r["title"], "|", r["folder_path"])


if __name__ == "__main__":
    main()
