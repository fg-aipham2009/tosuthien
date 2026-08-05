#!/usr/bin/env python3
"""Rename Diệu Pháp Âm folders + MP3 filenames to Vietnamese diacritics via HHTech."""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")
load_dotenv("/tmp/tosuthien-hhtech.env", override=True)

HHTECH_BASE_URL = os.environ.get("HHTECH_BASE_URL", "https://hhtechapi.com/v1").rstrip("/")
HHTECH_API_KEY = os.environ.get("HHTECH_API_KEY", "")
DEFAULT_MODEL = os.environ.get("HHTECH_CHAT_MODEL", "claude-opus-4-6")

ROOT = "Diệu Pháp Âm"
ALBUM = BASE_DIR / "data" / "mp3" / ROOT
OUT_FOLDERS = BASE_DIR / "data" / "backups" / "dieu-phap-am-co-nhac-folders.json"
OUT_SUBFOLDERS = BASE_DIR / "data" / "backups" / "dieu-phap-am-co-nhac-subfolders.json"
OUT_TITLES = BASE_DIR / "data" / "backups" / "dieu-phap-am-co-nhac-titles.json"
OUT_PLAN = BASE_DIR / "data" / "backups" / "dieu-phap-am-co-nhac-rename-plan.json"
OUT_SQL = BASE_DIR / "data" / "backups" / "seed-mp3-dieu-phap-am-co-nhac.sql"
PUBLIC_BASE = "https://api.tosuthien.net/files/mp3"
SLUG = "dieu-phap-am"

FOLDER_SYSTEM = """Bạn là biên tập viên đặt tên thư mục album Diệu Pháp Âm (Hòa thượng Thích Duy Lực).
Input: JSON {tên_hiện_tại: null}.
Output: CHỈ JSON {tên_hiện_tại: tên_chuẩn}.

Quy tắc bắt buộc:
1) Giữ số thứ tự đầu (01, 03, 04… — có thể thiếu 02). Format: "{số} {Tên có dấu}" — khoảng trắng sau số, không ALL CAPS.
2) Tiếng Việt có dấu đúng thuật ngữ Phật giáo: Duy Lực Ngữ Lục, Kinh Viên Giác, Kinh Lăng Già, Kinh Lăng Nghiêm, Góp nhặt lời Phật Tổ, Cội nguồn truyền thừa, Phật pháp và Khoa học, Kinh Pháp Hoa, Kinh Kim Cang, Kinh Hoa Nghiêm, Kinh Bát Nhã Ba La Mật, Phật pháp với Thiền tông, Vũ trụ quan, Tham thiền cảnh ngữ, Trung Phong Pháp ngữ, Đại thừa tuyệt đối luận, Lâm Tế – Tham Tổ Sư Thiền, Nam Tuyền – Bảo Tạng Luận, Kinh Duy Ma Cật, Pháp Bảo Đàn Kinh, Triệu luận lược giải, Tín Tâm Minh tích nghĩa giải, Đại Huệ Ngữ Lục, Tham thiền phổ thuyết, Thiền thất khai thị lục…
3) Bỏ khoảng trắng thừa (vd "24  DAI" → "24 Đại Huệ Ngữ Lục").
4) Không dùng / \\ : * ? " < > | trong tên.
5) Không bịa thêm nội dung.
"""

SUBFOLDER_SYSTEM = """Bạn là biên tập viên đặt tên thư mục con trong album Diệu Pháp Âm.
Input: JSON {đường_dẫn_tương_đối: null} — ví dụ "01 DUY LUC NGU LUC/Quyen Ha".
Output: CHỈ JSON {đường_dẫn_tương_đối: tên_thư_mục_con_chuẩn} — CHỈ tên thư mục con (không gồm thư mục cha).

Quy tắc:
1) Tiếng Việt có dấu: Quyển Thượng, Quyển Hạ, …
2) Không ALL CAPS. Không số thừa nếu vốn không có.
3) Không dùng / \\ : * ? " < > |.
"""

TITLE_SYSTEM = """Bạn là biên tập viên đặt tên bài MP3 album Diệu Pháp Âm (Hòa thượng Thích Duy Lực).
Input: JSON {stem_file: null} — stem là tên file bỏ .mp3.
Output: CHỈ JSON {stem_file: title_chuẩn}.

Quy tắc bắt buộc:
1) Title sạch tiếng Việt có dấu. Bỏ tiền tố rác: "DPA ", "TTPT", "TTM" mở rộng đúng nghĩa khi rõ (Tín Tâm Minh / Tham thiền phổ thuyết).
2) Format ưu tiên: "{số} {nội dung có dấu}" — số đầu cách nội dung bằng khoảng trắng (không underscore).
3) Bỏ (01-AudioTrack 01), (AudioTrack 01) nếu chỉ là mã track kỹ thuật; giữ phần nội dung hữu ích trong ngoặc.
4) Thuật ngữ chuẩn: Bồ Tát, Viên Giác, Lăng Già, Lăng Nghiêm, Pháp Hoa, Kim Cang, Hoa Nghiêm, Bát Nhã, Duy Ma Cật, Pháp Bảo Đàn, Triệu luận, Tín Tâm Minh, Đại Huệ, Tổ Sư Thiền, Lâm Tế, Nam Tuyền, Bảo Tạng Luận, Duy Lực Ngữ Lục, quyển thượng/hạ…
5) Viết hoa tên kinh / danh từ riêng; không Title Case từng chữ kiểu Anh; không ALL CAPS.
6) Giữ mã băng hữu ích cuối title: 001 A, 002 B…
7) Không bịa nội dung. Không thêm .mp3.
8) Ví dụ:
   - "DPA Bo Tat Gioi 01" → "01 Bồ Tát Giới"
   - "DPA Kinh Lang Nghiem 10" → "10 Kinh Lăng Nghiêm"
   - "DPA TTM 1 (01-AudioTrack 01)" → "01 Tín Tâm Minh tích nghĩa giải"
   - "DPA TTPT 01 (AudioTrack 01)" → "01 Tham thiền phổ thuyết"
   - "30_Loi-Gioi-Thieu" → "30 Lời giới thiệu"
"""

UNSAFE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def safe_fs(name: str) -> str:
    n = UNSAFE.sub("_", nfc(name)).strip().rstrip(".")
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
    t = stem
    t = re.sub(r"^DPA\s+", "", t, flags=re.I)
    t = t.replace("_", " ").replace("-", " ")
    t = re.sub(r"\s+", " ", t).strip(" .")
    return t


def unique_name(desired: str, used: set[str]) -> str:
    base = safe_fs(desired)
    key = base.casefold()
    if key not in {u.casefold() for u in used}:
        used.add(base)
        return base
    i = 2
    while f"{base} ({i})".casefold() in {u.casefold() for u in used}:
        i += 1
    name = f"{base} ({i})"
    used.add(name)
    return name


def two_phase_rename(src: Path, dest: Path) -> None:
    if src.name == dest.name and src.parent == dest.parent:
        return
    # case-only / NFD↔NFC on case-insensitive APFS: same path identity
    same_identity = src.parent == dest.parent and (
        src.name.casefold() == dest.name.casefold()
        or nfc(src.name).casefold() == nfc(dest.name).casefold()
        or (dest.exists() and src.resolve() == dest.resolve())
    )
    if same_identity:
        tmp = src.parent / f".__renaming__{hash(src.name) & 0xffff}"
        n = 0
        while tmp.exists():
            n += 1
            tmp = src.parent / f".__renaming__{n}_{hash(src.name) & 0xffff}"
        src.rename(tmp)
        tmp.rename(dest)
        return
    if dest.exists():
        raise SystemExit(f"collision: {dest}")
    src.rename(dest)


def collect_tracks(album: Path) -> list[Path]:
    return sorted(album.rglob("*.mp3"), key=lambda p: str(p).lower())


def apply_renames(
    folder_map: dict[str, str],
    subfolder_map: dict[str, str],
    title_map: dict[str, str],
    dry_run: bool,
):
    top_dirs = sorted([p for p in ALBUM.iterdir() if p.is_dir()], key=lambda p: p.name.lower())
    used_top: set[str] = set()
    top_old_to_new: dict[str, str] = {}
    for folder in top_dirs:
        desired = folder_map.get(folder.name) or folder.name
        top_old_to_new[folder.name] = unique_name(desired, used_top)

    # Rename top folders
    if not dry_run:
        for folder in top_dirs:
            new_name = top_old_to_new[folder.name]
            if folder.name == new_name:
                continue
            print(f"folder: {folder.name} -> {new_name}")
            two_phase_rename(folder, folder.parent / new_name)

    live_top = {p.name: p for p in ALBUM.iterdir() if p.is_dir()}
    # Map old top -> live path
    top_paths: dict[str, Path] = {}
    for old, new in top_old_to_new.items():
        top_paths[old] = live_top.get(new) or (ALBUM / new)

    # Rename one-level subfolders (e.g. Quyen Ha)
    sub_plan: dict[str, str] = {}
    for old_top, top_path in top_paths.items():
        if not top_path.is_dir():
            continue
        for sub in sorted([p for p in top_path.iterdir() if p.is_dir()], key=lambda p: p.name.lower()):
            key = f"{old_top}/{sub.name}"
            desired = subfolder_map.get(key) or sub.name
            # Prefer NFC Vietnamese defaults for known quyển
            if desired == sub.name:
                low = sub.name.casefold().replace(" ", "")
                if low in {"quyenha", "quyểnhạ", "quyen hạ".replace(" ", "")}:
                    desired = "Quyển Hạ"
                elif low in {"quyenthuong", "quyểnthượng"} or "thuong" in low or "thượng" in low:
                    desired = "Quyển Thượng"
            new_sub = safe_fs(desired)
            sub_plan[key] = new_sub
            if dry_run or sub.name == new_sub:
                continue
            print(f"subfolder: {key} -> {new_sub}")
            two_phase_rename(sub, top_path / new_sub)

    # Refresh tree and rename files
    rows = []
    sort_order = 0
    file_plan = []
    for old_top in sorted(top_old_to_new.keys(), key=lambda x: top_old_to_new[x].lower()):
        new_top = top_old_to_new[old_top]
        top_path = ALBUM / new_top
        if dry_run:
            top_path = next(p for p in top_dirs if p.name == old_top)
        used_names: dict[Path, set[str]] = {}
        tracks = sorted(top_path.rglob("*.mp3"), key=lambda p: str(p).lower())
        for path in tracks:
            title = title_map.get(path.stem) or title_fallback(path.stem)
            title = re.sub(r"^(\d+)_+", r"\1 ", title)
            title = re.sub(r"\s+", " ", safe_fs(title)).strip()
            parent = path.parent
            used = used_names.setdefault(parent, set())
            new_stem = unique_name(title, used)
            new_name = f"{new_stem}.mp3"
            rel_parent = parent.relative_to(top_path if not dry_run else top_path)
            # storage relative to album root
            if dry_run:
                storage_folder = Path(new_top)
                # approximate subfolder name from plan
                if parent != (next(p for p in top_dirs if p.name == old_top)):
                    key = f"{old_top}/{parent.name}"
                    storage_folder = Path(new_top) / sub_plan.get(key, parent.name)
            else:
                storage_folder = parent.relative_to(ALBUM)

            file_plan.append(
                {
                    "old": str(path.relative_to(ALBUM if not dry_run else ALBUM)),
                    "title": title,
                    "new_filename": new_name,
                    "folder_path": f"{ROOT}/{storage_folder.as_posix().rstrip('/')}/"
                    if str(storage_folder) != "."
                    else f"{ROOT}/{new_top}/",
                }
            )
            dest = parent / new_name
            if not dry_run and path.name != new_name:
                # hardlinked source: break link by copy-on-rename via temp when needed
                print(f"file: {path.relative_to(ALBUM)} -> {new_name}")
                if dest.exists() and dest.resolve() != path.resolve():
                    raise SystemExit(f"file collision {dest}")
                two_phase_rename(path, dest)
                path = dest

            folder_path = f"{ROOT}/{path.parent.relative_to(ALBUM).as_posix()}/"
            storage = f"{ROOT}/{path.relative_to(ALBUM).as_posix()}"
            rows.append(
                {
                    "title": title,
                    "folder_path": folder_path,
                    "filename": path.name if not dry_run else new_name,
                    "storage_path": storage if not dry_run else f"{ROOT}/{(path.parent.relative_to(ALBUM) / new_name).as_posix()}",
                    "file_size_bytes": path.stat().st_size,
                    "sort_order": sort_order,
                }
            )
            sort_order += 1

    save_json(
        OUT_PLAN,
        {
            "root": ROOT,
            "folders": top_old_to_new,
            "subfolders": sub_plan,
            "tracks": len(rows),
            "files": file_plan[:20],
        },
    )

    def esc(s: str) -> str:
        return s.replace("'", "''")

    def url(storage: str) -> str:
        return PUBLIC_BASE + "/" + "/".join(urllib.parse.quote(p, safe="") for p in storage.split("/"))

    lines = [
        "-- Seed MP3: Diệu Pháp Âm — Vietnamese diacritic titles",
        "BEGIN;",
        "",
        "INSERT INTO media_categories (slug, name, description, sort_order)",
        f"VALUES ('{SLUG}', '{esc(ROOT)}', 'Diệu Pháp Âm – Hòa thượng Thích Duy Lực', 9)",
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
    print("--- folders ---")
    for k, v in sorted(top_old_to_new.items(), key=lambda x: x[1]):
        print(f"  {k} -> {v}")
    print("--- sample titles ---")
    for r in rows[:12]:
        print(f"  {r['title']} | {r['folder_path']}")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--batch-size", type=int, default=18)
    ap.add_argument("--apply-only", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fresh", action="store_true")
    args = ap.parse_args()

    if not ALBUM.is_dir():
        raise SystemExit(f"missing {ALBUM}")

    top_dirs = sorted([p for p in ALBUM.iterdir() if p.is_dir()], key=lambda p: p.name.lower())
    folder_names = [p.name for p in top_dirs]
    subfolder_keys = []
    for top in top_dirs:
        for sub in sorted([p for p in top.iterdir() if p.is_dir()], key=lambda p: p.name.lower()):
            subfolder_keys.append(f"{top.name}/{sub.name}")
    tracks = collect_tracks(ALBUM)
    stems = [p.stem for p in tracks]
    print(f"folders={len(folder_names)} subfolders={len(subfolder_keys)} tracks={len(tracks)}")

    folder_map = {} if args.fresh else load_json(OUT_FOLDERS)
    subfolder_map = {} if args.fresh else load_json(OUT_SUBFOLDERS)
    title_map = {} if args.fresh else load_json(OUT_TITLES)

    if not args.apply_only:
        if not HHTECH_API_KEY:
            raise SystemExit("Missing HHTECH_API_KEY")
        folder_map = {k: v for k, v in folder_map.items() if k in folder_names}
        folder_map = run_batches(
            FOLDER_SYSTEM,
            folder_names,
            folder_map,
            OUT_FOLDERS,
            args.model,
            min(args.batch_size, 14),
            "Đặt lại tên thư mục chuẩn:",
            lambda k: k,
        )
        for n in folder_names:
            folder_map[n] = safe_fs(folder_map.get(n) or n)
        save_json(OUT_FOLDERS, folder_map)

        if subfolder_keys:
            subfolder_map = {k: v for k, v in subfolder_map.items() if k in subfolder_keys}
            subfolder_map = run_batches(
                SUBFOLDER_SYSTEM,
                subfolder_keys,
                subfolder_map,
                OUT_SUBFOLDERS,
                args.model,
                min(args.batch_size, 12),
                "Đặt lại tên thư mục con (chỉ trả tên con):",
                lambda k: k.split("/")[-1],
            )
            for k in subfolder_keys:
                subfolder_map[k] = safe_fs(subfolder_map.get(k) or k.split("/")[-1])
            save_json(OUT_SUBFOLDERS, subfolder_map)

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

        print("--- preview folders ---")
        for k in folder_names:
            print(f"  {k} -> {folder_map[k]}")
        print("--- preview titles ---")
        for p in tracks[:10]:
            print(f"  {p.stem} -> {title_map[p.stem]}")

    apply_renames(folder_map, subfolder_map, title_map, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
