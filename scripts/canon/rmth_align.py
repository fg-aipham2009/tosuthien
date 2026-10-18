#!/usr/bin/env python3
"""Align Rộng Mở Tâm Hồn Vietnamese onto CBETA segments (Astra), then export bilingual JSON/MD.

Accuracy gate: every CBETA segment gets a same-row `content_vi`; Astra reviews pairs; flagged
rows stay flagged (not marked complete). Prefer RMTH wording — do not retranslate from scratch.

Usage:
  HHTECH_API_KEYS_FILE=$HOME/.config/tosuthien/hhtech_keys \\
  python3 scripts/canon/rmth_align.py --stem X37n0672 --stem X59n1052 \\
      --out-dir data/cbeta/translations/X --model gpt-6-astra
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
from dataclasses import asdict
from pathlib import Path

from bilingual_format import write_bilingual_markdown
from cbeta_parser import parse_file, work_title
from rmth_lookup import fetch_vietnamese_text, load_cache, write_skip_marker
from translate_work import Usage, batches, with_retry
from try_translate import PROMPT_DIR, chat, load_env, parse_json

CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")


def _api_json(obj: object) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def seed_url_for(stem: str, out_dir: Path) -> str | None:
    cache = load_cache(out_dir)
    hit = cache.get(stem) or {}
    if hit.get("url"):
        return hit["url"]
    tsv = out_dir / "_rmth_has_viet.tsv"
    if tsv.exists():
        for row in csv.DictReader(tsv.open(encoding="utf-8"), delimiter="\t"):
            if row.get("stem") == stem and row.get("url"):
                return row["url"]
    marker = out_dir / f"{stem}.rmth.json"
    if marker.exists():
        try:
            return json.loads(marker.read_text(encoding="utf-8")).get("url")
        except json.JSONDecodeError:
            return None
    return None


def align_batch(model: str, system: str, title: str, rmth_vi: str, batch: list, offset: int,
                usage: Usage) -> dict[str, dict]:
    payload = {
        "work": title,
        "rmth_vi": rmth_vi,
        "segments": [
            {"n": str(offset + i + 1), "zh": s.content_zh, "type": s.segment_type}
            for i, s in enumerate(batch)
        ],
    }
    raw, u, sec = chat(model, system, _api_json(payload))
    usage.add(model, u, sec)
    data = parse_json(raw)
    items = data.get("items") if isinstance(data, dict) else data
    out: dict[str, dict] = {}
    for item in items or []:
        n = str(item.get("n") or "")
        if not n:
            continue
        out[n] = {
            "vi": str(item.get("vi") or "").strip(),
            "flag": item.get("flag"),
            "note": str(item.get("note") or ""),
        }
    return out


def review_batch(model: str, system: str, rows: list[dict], usage: Usage) -> list[dict]:
    payload = [
        {"n": r["n"], "zh": r["content_zh"], "vi": r["content_vi"], "type": r["segment_type"]}
        for r in rows
    ]
    raw, u, sec = chat(model, system, _api_json(payload))
    usage.add(model, u, sec)
    data = parse_json(raw)
    return data.get("issues", []) if isinstance(data, dict) else (data or [])


def fix_batch(model: str, system: str, title: str, rmth_vi: str, rows: list[dict],
              issues: dict[str, str], usage: Usage) -> dict[str, str]:
    """Ask Astra to revise only flagged numbers, still grounded in RMTH."""
    payload = {
        "work": title,
        "rmth_vi": rmth_vi,
        "fix": issues,
        "segments": [
            {"n": r["n"], "zh": r["content_zh"], "type": r["segment_type"], "vi": r["content_vi"]}
            for r in rows if r["n"] in issues
        ],
        "instruction": (
            "Sửa CHỈ các câu trong fix. Dựa RMTH + nghĩa zh. "
            "Trả {\"items\":[{\"n\",\"vi\",\"flag\",\"note\"}]}."
        ),
    }
    raw, u, sec = chat(model, system, _api_json(payload))
    usage.add(model, u, sec)
    data = parse_json(raw)
    items = data.get("items") if isinstance(data, dict) else data
    return {str(it.get("n")): str(it.get("vi") or "").strip() for it in (items or []) if it.get("n")}


class AlignOpts:
    def __init__(self, max_attempts: int = 5, retry_wait: int = 30) -> None:
        self.max_attempts = max_attempts
        self.retry_wait = retry_wait


def xml_for(stem: str, canon_dir: Path) -> Path:
    m = re.match(r"(X\d+)n", stem)
    if not m:
        raise SystemExit(f"bad stem: {stem}")
    path = canon_dir / m.group(1) / f"{stem}.xml"
    if not path.exists():
        raise SystemExit(f"missing XML: {path}")
    return path


def align_work(stem: str, *, canon_dir: Path, out_dir: Path, model: str,
               batch_chars: int, max_rmth_chars: int) -> dict:
    xml_path = xml_for(stem, canon_dir)
    title = work_title(xml_path) or stem
    segments = parse_file(xml_path, "X")
    seed = seed_url_for(stem, out_dir)
    text_cache = out_dir / "_rmth_viet_text" / f"{stem}.txt"
    meta_cache = out_dir / "_rmth_viet_text" / f"{stem}.meta.json"
    if text_cache.exists() and text_cache.stat().st_size > 0:
        rmth_body = text_cache.read_text(encoding="utf-8")
        meta = json.loads(meta_cache.read_text(encoding="utf-8")) if meta_cache.exists() else {}
        fetched = {
            "urls": meta.get("urls") or ([seed] if seed else []),
            "text": rmth_body,
            "chars": len(rmth_body),
            "pages": meta.get("pages") or 1,
            "note": meta.get("note") or "cache",
        }
        print(f"  {stem}: RMTH text from cache ({fetched['chars']:,} chars)", file=sys.stderr, flush=True)
    else:
        fetched = fetch_vietnamese_text(stem, title, seed_url=seed)
        text_cache.parent.mkdir(parents=True, exist_ok=True)
        text_cache.write_text(fetched["text"], encoding="utf-8")
        meta_cache.write_text(
            json.dumps({k: v for k, v in fetched.items() if k != "text"}, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
    rmth_vi = fetched["text"]
    if not rmth_vi:
        raise RuntimeError(f"{stem}: no RMTH Vietnamese text ({fetched.get('note')})")
    if len(rmth_vi) > max_rmth_chars:
        # Keep head+tail so model still sees start/end; middle flagged if needed.
        keep = max_rmth_chars // 2
        rmth_vi = rmth_vi[:keep] + "\n\n[…]\n\n" + rmth_vi[-keep:]

    align_system = (PROMPT_DIR / "rmth_align.md").read_text(encoding="utf-8")
    review_system = (PROMPT_DIR / "rmth_fix.md").read_text(encoding="utf-8")
    usage = Usage()
    opts = AlignOpts()
    started = time.time()

    print(f"▶ {stem} {title}: {len(segments)} segs · RMTH {fetched['chars']:,} chars "
          f"/{fetched['pages']} page(s)", file=sys.stderr, flush=True)

    aligned: dict[str, dict] = {}
    offset = 0
    for batch in batches(segments, batch_chars):
        part = with_retry(opts, align_batch, model, align_system, title, rmth_vi, batch, offset, usage)
        aligned.update(part)
        offset += len(batch)
        print(f"  {stem} align {offset}/{len(segments)}", file=sys.stderr, flush=True)

    rows: list[dict] = []
    for i, seg in enumerate(segments):
        n = str(i + 1)
        hit = aligned.get(n) or {}
        vi = (hit.get("vi") or "").strip()
        flag = hit.get("flag")
        issues: list[dict] = []
        status = "ai_checked"
        if not vi:
            status = "flagged"
            issues.append({"type": "thieu_rmth", "detail": "RMTH không có / chưa gán được"})
        elif flag in ("thieu_rmth", "unsure"):
            status = "flagged"
            issues.append({"type": flag, "detail": hit.get("note") or flag})
        rows.append({
            **asdict(seg),
            "n": n,
            "content_vi": vi,
            "status": status,
            "retried": False,
            "first_review": None,
            "open_issues": issues,
            "rmth_align": {"flag": flag, "note": hit.get("note") or ""},
        })

    # Review + optional fix per batch (paragraph-aware batches, same as translate_work).
    rev_offset = 0
    for batch in batches(segments, batch_chars):
        chunk = rows[rev_offset: rev_offset + len(batch)]
        rev_offset += len(batch)
        issues = with_retry(opts, review_batch, model, review_system, chunk, usage)
        by_n: dict[str, list[dict]] = {}
        for issue in issues:
            n = str(issue.get("n") or "")
            if n:
                by_n.setdefault(n, []).append(issue)
        fix_notes = {
            n: "; ".join(f'{i.get("type")}: {i.get("detail")}' for i in lst)
            for n, lst in by_n.items()
        }
        for n, lst in by_n.items():
            for issue in lst:
                sug = str(issue.get("suggest") or "").strip()
                if sug:
                    rows[int(n) - 1]["content_vi"] = sug
                    rows[int(n) - 1]["retried"] = True
        need_fix = {
            n: note for n, note in fix_notes.items()
            if not any(str(i.get("suggest") or "").strip() for i in by_n[n])
        }
        if need_fix:
            fixed = with_retry(
                opts, fix_batch, model, align_system, title, rmth_vi, chunk, need_fix, usage,
            )
            for n, vi in fixed.items():
                if vi:
                    rows[int(n) - 1]["content_vi"] = vi
                    rows[int(n) - 1]["retried"] = True

        # Always re-review the chunk when anything was wrong or empty.
        if by_n or any(not (r.get("content_vi") or "").strip() for r in chunk):
            issues2 = with_retry(opts, review_batch, model, review_system, chunk, usage)
        else:
            issues2 = []
        still_flagged: dict[str, list[dict]] = {}
        for issue in issues2:
            n = str(issue.get("n") or "")
            if n:
                still_flagged.setdefault(n, []).append(issue)
        for r in chunk:
            n = r["n"]
            if not (r.get("content_vi") or "").strip():
                still_flagged.setdefault(n, []).append(
                    {"type": "thieu_rmth", "detail": "vẫn trống sau khi sửa"},
                )
            align_flag = (r.get("rmth_align") or {}).get("flag")
            if n in still_flagged:
                r["status"] = "flagged"
                r["open_issues"] = still_flagged[n]
                r["first_review"] = fix_notes.get(n) or r.get("first_review")
            elif align_flag in ("thieu_rmth", "unsure") and not (r.get("content_vi") or "").strip():
                r["status"] = "flagged"
            else:
                r["status"] = "ai_checked"
                r["open_issues"] = []

    elapsed = time.time() - started
    work_code = re.sub(r"^[A-Z]+\d+n", "X", stem)
    out_dir.mkdir(parents=True, exist_ok=True)
    # Drop helper key before save
    save_rows = []
    for r in rows:
        item = {k: v for k, v in r.items() if k != "n"}
        save_rows.append(item)

    missing_vi = sum(1 for r in save_rows if not (r.get("content_vi") or "").strip())
    flagged = sum(1 for r in save_rows if r["status"] == "flagged")
    data = {
        "work_code": work_code,
        "title_zh": title,
        "source": xml_path.name,
        "translator": f"rmth+{model}",
        "reviewer": model,
        "rmth": {
            "urls": fetched["urls"],
            "pages": fetched["pages"],
            "chars": fetched["chars"],
            "note": fetched.get("note"),
        },
        "usage": usage.by_model,
        "elapsed": elapsed,
        "segments": save_rows,
    }
    json_path = out_dir / f"{stem}.json"
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    write_bilingual_markdown(json_path, work_code, title, save_rows)
    write_skip_marker(out_dir, {
        "stem": stem, "title_zh": title, "has_viet": True,
        "url": (fetched["urls"] or [None])[0],
        "note": "aligned rmth+astra → bilingual json",
        "aligned": True,
    })

    # Spot-check file: first/last pairs + flagged
    check_lines = [
        f"# RMTH align check · {stem} {title}\n",
        f"- RMTH pages: {fetched['pages']} · chars: {fetched['chars']:,}",
        f"- Segments: {len(save_rows)} · missing_vi: {missing_vi} · flagged: {flagged}",
        f"- Credits≈ {usage.total_credits():,.1f} · {elapsed:.0f}s · model `{model}`\n",
        "## Sample pairs\n",
    ]
    for r in save_rows[:5] + save_rows[-3:]:
        check_lines.append(f"- [{r['segment_type']}] {r['content_zh']}\n  → {r['content_vi']}\n")
    if flagged:
        check_lines.append("## Flagged\n")
        for r in save_rows:
            if r["status"] == "flagged":
                check_lines.append(
                    f"- [{r.get('cbeta_ref')}] {r['content_zh']}\n"
                    f"  → {r['content_vi']}\n  !! {r.get('open_issues')}\n"
                )
    check_path = out_dir / f"{stem}.rmth_align_check.md"
    check_path.write_text("\n".join(check_lines), encoding="utf-8")

    return {
        "stem": stem, "title": title, "segments": len(save_rows),
        "missing_vi": missing_vi, "flagged": flagged,
        "credits": usage.total_credits(), "elapsed": elapsed,
        "cjk": sum(len(CJK.findall(s.content_zh)) for s in segments),
        "json": str(json_path),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--stem", action="append", required=True, help="CBETA stem, repeatable")
    ap.add_argument("--canon-dir", default="data/cbeta/xml-p5/X")
    ap.add_argument("--out-dir", default="data/cbeta/translations/X")
    ap.add_argument("--model", default="gpt-6-astra")
    ap.add_argument("--batch-chars", type=int, default=1800,
                    help="Max Chinese chars per align/review batch (paragraph-aware)")
    ap.add_argument("--max-rmth-chars", type=int, default=120_000,
                    help="Truncate very long RMTH text for the prompt")
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[2]
    load_env(root / ".env")
    os.environ.setdefault("HHTECH_API_KEYS_FILE",
                          str(Path.home() / ".config/tosuthien/hhtech_keys"))

    canon_dir = (root / args.canon_dir).resolve() if not Path(args.canon_dir).is_absolute() else Path(args.canon_dir)
    out_dir = (root / args.out_dir).resolve() if not Path(args.out_dir).is_absolute() else Path(args.out_dir)

    summaries = []
    for stem in args.stem:
        summaries.append(align_work(
            stem, canon_dir=canon_dir, out_dir=out_dir, model=args.model,
            batch_chars=args.batch_chars, max_rmth_chars=args.max_rmth_chars,
        ))

    print("\nstem\ttitle\tsegs\tmissing_vi\tflagged\tcjk\tcredits\telapsed_s")
    for s in summaries:
        print(f"{s['stem']}\t{s['title']}\t{s['segments']}\t{s['missing_vi']}\t{s['flagged']}\t"
              f"{s['cjk']}\t{s['credits']:.1f}\t{s['elapsed']:.0f}")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as err:
        sys.exit(f"HTTP {err.code}: {err.read().decode(errors='ignore')}")
