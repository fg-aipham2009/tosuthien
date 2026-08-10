#!/usr/bin/env python3
"""Re-standardize Sư Phụ Giảng Kinh folder + title names via HHTech (strict role)."""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")

HHTECH_BASE_URL = os.environ.get("HHTECH_BASE_URL", "https://hhtechapi.com/v1").rstrip("/")
HHTECH_API_KEY = os.environ.get("HHTECH_API_KEY", "")
DEFAULT_MODEL = os.environ.get("HHTECH_CHAT_MODEL", "claude-opus-4-6")

ROOT = "Sư Phụ Giảng Kinh"
ALBUM = BASE_DIR / "data" / "mp3" / ROOT
OUT_FOLDERS = BASE_DIR / "data" / "backups" / "su-phu-giang-kinh-folders-v2.json"
OUT_TITLES = BASE_DIR / "data" / "backups" / "su-phu-giang-kinh-titles-v2.json"
OUT_PLAN = BASE_DIR / "data" / "backups" / "su-phu-giang-kinh-rename-plan-v2.json"
OUT_SQL = BASE_DIR / "data" / "backups" / "seed-mp3-su-phu-giang-kinh.sql"
PUBLIC_BASE = "https://api.tosuthien.net/files/mp3"
SLUG = "su-phu-giang-kinh"

FOLDER_SYSTEM = """Bạn là biên tập viên đặt tên thư mục Pháp Âm Tổ Sư Thiền (Hòa thượng Thích Duy Lực).
Input: JSON {tên_hiện_tại: null}.
Output: CHỈ JSON {tên_hiện_tại: tên_chuẩn}.

Quy tắc bắt buộc:
1) Giữ nguyên số thứ tự đầu (01_, 02_, …) nếu có. Không thêm số nếu vốn không có.
2) Tiếng Việt có dấu đúng thuật ngữ: Lăng Nghiêm, Pháp Bảo Đàn, Phạm Võng, Tín Tâm Minh, Kim Cang, Viên Giác, Tổ Sư Thiền, Tịnh Độ, thiền đường, quy củ…
3) Viết hoa kiểu tiêu đề tiếng Việt: viết hoa chữ cái đầu cụm danh từ riêng / tên kinh; không ALL CAPS; không Title Case từng chữ kiểu Anh.
   Ví dụ tốt: "01_Giảng Kinh Lăng Nghiêm", "15_Quy củ thiền đường", "Kinh Kim Cang (tiếng Quảng)".
4) Bỏ rác: @, MP3, CD, _M, dấu gạch thừa.
5) Giữ metadata hữu ích trong ngoặc: (10 mục), (90'), (tiếng Quảng), (114').
6) Không bịa thêm nội dung. Không dùng / \\ : * ? " < > | trong tên.
7) "Loc" trong "Phổ thuyết Loc" thường là "lượt/lọc bản" → ưu tiên "Phổ thuyết (bản lọc)" nếu ngữ cảnh rõ; nếu không chắc giữ "Phổ thuyết".
"""

TITLE_SYSTEM = """Bạn là biên tập viên đặt tên bài Pháp Âm Tổ Sư Thiền (Hòa thượng Thích Duy Lực).
Input: JSON {stem_file: null} — stem là tên file bỏ .mp3.
Output: CHỈ JSON {stem_file: title_chuẩn}.

Quy tắc bắt buộc:
1) Title hiển thị sạch: không còn @, @@@@, X, XX, chữ M rác cuối (M = mặt đĩa A/B khi đứng cạnh số — giữ A/B, bỏ chữ M thừa).
2) Format ưu tiên: "{số} {nội dung có dấu} {mã băng nếu có}"
   - Số đầu: "01", "02"… cách nội dung bằng DẤU CÁCH (không dùng underscore sau số).
   - Mã băng kiểu 190 B, 251 A, 049 A giữ nguyên cuối title.
3) Thay mọi "_" trong phần nội dung bằng khoảng trắng hoặc dấu phẩy / gạch ngang ngắn khi tự nhiên.
4) Thuật ngữ chuẩn: Sư phụ, Hòa thượng, Tổ Sư Thiền, Lăng Nghiêm, Pháp Bảo Đàn, Phạm Võng, Tín Tâm Minh, Kim Cang, Viên Giác, Tịnh Độ, quy củ, thiền đường, quy y Tam Bảo, giới Bồ Tát…
5) Viết hoa đúng: viết hoa tên kinh / danh từ riêng; phần còn lại câu bình thường (không Title Case từng chữ).
6) PP → Phật pháp; SP → Sư phụ; HT → Hòa thượng; TST → Tổ Sư Thiền; Kh Hoc → Khoa học.
7) Không bịa nội dung mới. Không thêm .mp3.
8) Ví dụ:
   - "01_Kinh Vien Giac 049 A@" → "01 Kinh Viên Giác 049 A"
   - "01 Tam Qui Ngu Gioi." → "01 Tam quy ngũ giới"
   - "01_Tin Tam Minh M_1 A@" → "01 Tín Tâm Minh 1 A"
"""

UNSAFE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def safe_fs(name: str) -> str:
    n = UNSAFE.sub("_", name).strip().rstrip(".")
    return re.sub(r"\s+", " ", n) or "untitled"


def parse_json_object(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        raise ValueError(f"No JSON: {text[:180]}")
    return json.loads(text[start : end + 1])


def chat_batch(system: str, keys: list[str], model: str, prefix: str) -> dict[str, str]:
    body = {
        "model": model,
        "max_tokens": 8192,
        "temperature": 0.05,
        "messages": [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": prefix + "\n" + json.dumps({k: None for k in keys}, ensure_ascii=False),
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
    parsed = parse_json_object(data["choices"][0]["message"]["content"])
    out: dict[str, str] = {}
    for k in keys:
        v = parsed.get(k)
        if isinstance(v, str) and v.strip():
            out[k] = v.strip()
    return out


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def run_batches(system, keys, mapping, out_path, model, batch_size, prefix, fallback):
    pending = [k for k in keys if k not in mapping]
    print(f"pending={len(pending)} done={len(mapping)} model={model}")
    for i in range(0, len(pending), batch_size):
        chunk = pending[i : i + batch_size]
        attempt = 0
        while True:
            attempt += 1
            try:
                got = chat_batch(system, chunk, model, prefix)
                mapping.update(got)
                for k in chunk:
                    mapping.setdefault(k, fallback(k))
                save_json(out_path, mapping)
                print(f"batch {i // batch_size + 1}: +{len(got)}/{len(chunk)} total={len(mapping)}")
                break
            except Exception as exc:  # noqa: BLE001
                wait = min(60, 5 * attempt)
                print(f"retry {attempt}: {exc}; sleep {wait}s")
                time.sleep(wait)
                if attempt >= 8:
                    for k in chunk:
                        mapping.setdefault(k, fallback(k))
                    save_json(out_path, mapping)
                    print("fallback batch")
                    break
        time.sleep(0.3)
    return mapping


def title_fallback(stem: str) -> str:
    t = stem.replace("_", " ")
    t = re.sub(r"@+", "", t)
    t = re.sub(r"\s+", " ", t).strip(" .")
    t = re.sub(r"^(\d+)\s*", r"\1 ", t)
    return t


def folder_fallback(name: str) -> str:
    return safe_fs(name)


def unique_name(desired: str, used: set[str]) -> str:
    base = safe_fs(desired)
    if base not in used:
        used.add(base)
        return base
    i = 2
    while f"{base} ({i})" in used:
        i += 1
    name = f"{base} ({i})"
    used.add(name)
    return name


def apply_and_sql(folder_map: dict[str, str], title_map: dict[str, str], dry_run: bool):
    folders = sorted([p for p in ALBUM.iterdir() if p.is_dir()], key=lambda p: p.name.lower())
    used: set[str] = set()
    old_to_new: dict[str, str] = {}
    for folder in folders:
        desired = folder_map.get(folder.name) or folder.name
        new_name = unique_name(desired, used)
        old_to_new[folder.name] = new_name

    # Two-phase rename: case-insensitive FS (macOS) needs temp hop for case-only changes.
    if not dry_run:
        temps: list[tuple[Path, Path, str]] = []
        for folder in folders:
            new_name = old_to_new[folder.name]
            if folder.name == new_name:
                continue
            tmp = folder.parent / f".__renaming__{folder.name}"
            n = 0
            while tmp.exists():
                n += 1
                tmp = folder.parent / f".__renaming__{n}_{folder.name}"
            print(f"folder: {folder.name} -> {new_name}")
            folder.rename(tmp)
            temps.append((tmp, folder.parent / new_name, new_name))
        for tmp, dest, new_name in temps:
            if dest.exists():
                raise SystemExit(f"collision {dest}")
            tmp.rename(dest)

    live = {p.name: p for p in ALBUM.iterdir() if p.is_dir()}
    rows = []
    sort_order = 0
    for old, new in sorted(old_to_new.items(), key=lambda x: x[1].lower()):
        if dry_run:
            folder = next(f for f in folders if f.name == old)
        else:
            folder = live.get(new) or (ALBUM / new)
        files = sorted(folder.glob("*.mp3"), key=lambda p: p.name.lower())
        for path in files:
            title = title_map.get(path.stem) or title_fallback(path.stem)
            title = re.sub(r"^(\d+)_+", r"\1 ", title)
            title = re.sub(r"\s+", " ", title).strip()
            folder_path = f"{ROOT}/{new}/"
            storage = f"{ROOT}/{new}/{path.name}"
            rows.append(
                {
                    "title": title,
                    "folder_path": folder_path,
                    "filename": path.name,
                    "storage_path": storage,
                    "file_size_bytes": path.stat().st_size,
                    "sort_order": sort_order,
                }
            )
            sort_order += 1

    save_json(
        OUT_PLAN,
        {"root": ROOT, "folders": old_to_new, "tracks": len(rows)},
    )

    def esc(s: str) -> str:
        return s.replace("'", "''")

    def url(storage: str) -> str:
        return PUBLIC_BASE + "/" + "/".join(urllib.parse.quote(p, safe="") for p in storage.split("/"))

    lines = [
        "-- Seed MP3: Sư Phụ Giảng Kinh — HHTech standardized titles v2",
        "BEGIN;",
        "",
        "INSERT INTO media_categories (slug, name, description, sort_order)",
        f"VALUES ('{SLUG}', '{esc(ROOT)}', 'Sư Phụ giảng kinh / khai thị', 3)",
        "ON CONFLICT (slug) DO UPDATE SET",
        "  name = EXCLUDED.name,",
        "  description = EXCLUDED.description,",
        "  sort_order = EXCLUDED.sort_order;",
        "",
        "DELETE FROM mp3_tracks",
        f"WHERE category_id = (SELECT id FROM media_categories WHERE slug = '{SLUG}');",
        "",
    ]
    batch = []
    for r in rows:
        batch.append(
            f"  ((SELECT id FROM media_categories WHERE slug = '{SLUG}'), "
            f"'{esc(r['title'])}', 1990, NULL, NULL, "
            f"'{esc(r['folder_path'])}', '{esc(r['filename'])}', "
            f"'{esc(r['storage_path'])}', '{esc(url(r['storage_path']))}', "
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
    lines += ["COMMIT;", ""]
    if not dry_run:
        OUT_SQL.write_text("\n".join(lines), encoding="utf-8")
        print(f"wrote {OUT_SQL} rows={len(rows)}")
    for r in rows[:8]:
        print(" sample:", r["title"], "|", r["folder_path"])
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--batch-size", type=int, default=18)
    ap.add_argument("--apply-only", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fresh", action="store_true", help="Ignore previous v2 JSON")
    args = ap.parse_args()

    if not ALBUM.is_dir():
        raise SystemExit(f"missing {ALBUM}")

    folders = sorted([p for p in ALBUM.iterdir() if p.is_dir()], key=lambda p: p.name.lower())
    folder_names = [p.name for p in folders]
    tracks = []
    for folder in folders:
        for path in sorted(folder.glob("*.mp3"), key=lambda p: p.name.lower()):
            tracks.append(path)

    print(f"folders={len(folder_names)} tracks={len(tracks)}")

    folder_map = {} if args.fresh else load_json(OUT_FOLDERS)
    title_map = {} if args.fresh else load_json(OUT_TITLES)

    if not args.apply_only:
        if not HHTECH_API_KEY:
            raise SystemExit("Missing HHTECH_API_KEY")
        # Always re-key by CURRENT disk names
        folder_map = {k: v for k, v in folder_map.items() if k in folder_names}
        folder_map = run_batches(
            FOLDER_SYSTEM,
            folder_names,
            folder_map,
            OUT_FOLDERS,
            args.model,
            min(args.batch_size, 12),
            "Đặt lại tên thư mục chuẩn:",
            folder_fallback,
        )
        for n in folder_names:
            folder_map[n] = safe_fs(folder_map.get(n) or n)
        save_json(OUT_FOLDERS, folder_map)

        stems = [p.stem for p in tracks]
        title_map = {k: v for k, v in title_map.items() if k in stems}
        title_map = run_batches(
            TITLE_SYSTEM,
            stems,
            title_map,
            OUT_TITLES,
            args.model,
            args.batch_size,
            "Đặt lại tên bài chuẩn:",
            title_fallback,
        )
        for s in stems:
            title_map.setdefault(s, title_fallback(s))
        save_json(OUT_TITLES, title_map)

        print("--- folders ---")
        for k in folder_names:
            print(f"  {k} -> {folder_map[k]}")
        print("--- titles sample ---")
        for p in tracks[:10]:
            print(f"  {p.stem} -> {title_map[p.stem]}")

    apply_and_sql(folder_map, title_map, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
