#!/usr/bin/env python3
"""Translate text the parser used to skip (list items / 科文, table cells, glossary forms) in finished works.

For each finished {stem}.json whose source now parses into rows it does not have:
  1. the existing rows are copied into <out-dir>/_supplement/{stem}.partial.json and translate_file
     translates only the missing rows there (resumable, same review / adjudication chain);
  2. under the work lock shared with adjudicate_file.py, the finished JSON is re-read (it may have received
     new verdicts meanwhile), merged with the new rows in source order, and {stem}.md re-rendered.

Usage:
  HHTECH_API_KEYS_FILE=... HHTECH_CONFIRM_KEYS_FILE=... python3 scripts/canon/supplement_finished.py \
      --canon-dir data/cbeta/xml-p5/X --workers 4 --batch-workers 4 \
      --translator claude-opus-5-5 --reviewer gpt-6-astra --confirmer claude-fable-5-1 --batch-chars 1200 \
      --max-attempts 5 --retry-wait 30 --out-dir data/cbeta/translations/X [--only X05n0228 ...] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from cbeta_parser import parse_file, work_title
from bilingual_format import write_bilingual_markdown
from translate_work import (CJK, Usage, add_common_args, align, batches, options_from, render_markdown,
                            translate_file, work_lock)
from try_translate import load_env


def merged_usage(a: dict, b: dict) -> dict:
    out = {m: dict(row) for m, row in a.items()}
    for model, row in b.items():
        acc = out.setdefault(model, {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
        for k in ("calls", "in", "out", "seconds"):
            acc[k] = acc.get(k, 0) + row.get(k, 0)
    return out


def gaps(xml: Path, finished: Path) -> tuple[list, int]:
    segments = parse_file(xml, xml.parent.parent.name)
    rows = json.loads(finished.read_text(encoding="utf-8"))["segments"]
    slots = align(segments, rows)
    missing = [s for s, r in zip(segments, slots) if r is None]
    return missing, sum(len(CJK.findall(s.content_zh)) for s in missing)


def supplement(xml: Path, out_dir: Path, opts) -> dict:
    stem = xml.stem
    finished = out_dir / f"{stem}.json"
    staging = out_dir / "_supplement"
    staging.mkdir(exist_ok=True)
    partial = staging / f"{stem}.partial.json"
    if not partial.exists() and not (staging / f"{stem}.json").exists():
        rows = json.loads(finished.read_text(encoding="utf-8"))["segments"]
        partial.write_text(json.dumps({"results": rows, "usage": {}, "elapsed": 0.0}, ensure_ascii=False),
                           encoding="utf-8")
    if not (staging / f"{stem}.json").exists():
        translate_file(xml, staging, opts)
    added = json.loads((staging / f"{stem}.json").read_text(encoding="utf-8"))

    with work_lock(finished):
        data = json.loads(finished.read_text(encoding="utf-8"))
        segments = parse_file(xml, xml.parent.parent.name)
        current = align(segments, data["segments"])
        new_rows = align(segments, added["segments"])
        rows = [c if c is not None else n for c, n in zip(current, new_rows)]
        if any(r is None for r in rows):
            raise RuntimeError(f"{stem}: rows still missing after supplement")
        data["segments"] = rows
        data["usage"] = merged_usage(data.get("usage") or {}, added.get("usage") or {})
        data["elapsed"] = (data.get("elapsed") or 0) + (added.get("elapsed") or 0)
        finished.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        title = data.get("title_zh") or work_title(xml) or stem
        md = render_markdown(data["work_code"], title, opts, segments, len(batches(segments, opts.batch_chars)),
                             data["elapsed"], Usage(data["usage"]), rows)
        finished.with_suffix(".md").write_text(md, encoding="utf-8")
        write_bilingual_markdown(finished, data["work_code"], title, rows)
    flagged = [r for r, c in zip(rows, current) if c is None and r["status"] == "flagged"]
    return {"file": stem, "supplement": True, "added_rows": sum(1 for c in current if c is None),
            "credits": Usage(added.get("usage") or {}).total_credits(), "flagged_added": len(flagged),
            "finished_at": time.strftime("%Y-%m-%d %H:%M:%S")}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--canon-dir", required=True)
    ap.add_argument("--workers", type=int, required=True)
    ap.add_argument("--only", nargs="*", help="Stems to supplement (default: every finished work with gaps)")
    ap.add_argument("--dry-run", action="store_true", help="Only list works with gaps and missing characters")
    add_common_args(ap)
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[2]
    load_env(root / ".env")
    opts = options_from(args)
    out_dir = (root / args.out_dir) if not Path(args.out_dir).is_absolute() else Path(args.out_dir)
    xml_by_stem = {p.stem: p for p in (root / args.canon_dir).glob("*/*.xml")}
    stems = args.only or sorted(p.stem for p in out_dir.glob("*.json") if not p.name.endswith(".partial.json")
                                and p.stem in xml_by_stem)
    todo = []
    for stem in stems:
        missing, chars = gaps(xml_by_stem[stem], out_dir / f"{stem}.json")
        if missing:
            todo.append(xml_by_stem[stem])
            print(f"{stem}: {len(missing)} row(s) · {chars:,} chữ to supplement", file=sys.stderr, flush=True)
    print(f"{len(todo)} finished work(s) to supplement", file=sys.stderr, flush=True)
    if args.dry_run or not todo:
        return

    ledger = out_dir / "_runs.jsonl"
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(supplement, xml, out_dir, opts): xml for xml in todo}
        for fut in as_completed(futures):
            stem = futures[fut].stem
            try:
                summary = fut.result()
                print(f"✔ supplement {stem} · +{summary['added_rows']} câu · {summary['credits']:,.0f} credit · "
                      f"cần duyệt thêm {summary['flagged_added']}", file=sys.stderr, flush=True)
            except Exception as err:  # noqa: BLE001
                summary = {"file": stem, "supplement": True, "error": repr(err),
                           "finished_at": time.strftime("%Y-%m-%d %H:%M:%S")}
                print(f"✘ supplement {stem}: {err}", file=sys.stderr, flush=True)
            with ledger.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(summary, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
