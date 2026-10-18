#!/usr/bin/env python3
"""Re-translate sentences of finished works that carry original-edition collation notes.

Works translated before the parser kept CBETA's type="orig" notes (lost leaves 佚失, suspected missing
characters 疑脫, suspected wrong characters A疑B) were translated without them. For each finished
{stem}.json this re-parses the XML, re-runs translate → review → adjudicate (→ confirm) on the batches of
the paragraphs that contain a noted sentence, replaces those rows and re-renders {stem}.md.
A row carrying the "source_notes" key is up to date, so the script can be re-run safely.

Usage:
    HHTECH_API_KEYS_FILE=... HHTECH_CONFIRM_KEYS_FILE=... python3 scripts/canon/apply_source_notes.py \
      --canon-dir data/cbeta/xml-p5/X --out-dir data/cbeta/translations/X \
      --translator claude-opus-5-5 --reviewer gpt-6-astra --confirmer claude-fable-5-1 \
      --batch-chars 1200 --max-attempts 5 --retry-wait 30 --workers 8
"""
from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from cbeta_parser import Segment, parse_file, work_title
from translate_work import (CJK, PROMPT_DIR, Options, Usage, add_common_args, batches, options_from,
                            process_batch, render_markdown)
from bilingual_format import write_bilingual_markdown
from try_translate import load_env


def stale_batches(segments: list[Segment], rows: list[dict], batch_chars: int) -> list[list[int]]:
    """Index lists (into segments) of the batches to redo: paragraphs holding a noted row not yet updated."""
    by_paragraph: dict[tuple, list[int]] = {}
    for i, seg in enumerate(segments):
        by_paragraph.setdefault((seg.juan_no, seg.paragraph_no), []).append(i)
    out = []
    for indices in by_paragraph.values():
        if not any(segments[i].source_notes and "source_notes" not in rows[i] for i in indices):
            continue
        start = indices[0]
        for batch in batches([segments[i] for i in indices], batch_chars):
            span = list(range(start, start + len(batch)))
            start += len(batch)
            if any(segments[i].source_notes for i in span):
                out.append(span)
    return out


def apply(json_path: Path, xml_path: Path, opts: Options, dry_run: bool) -> tuple[int, int, float]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    rows = data["segments"]
    segments = parse_file(xml_path, xml_path.parent.parent.name)
    if [(s.juan_no, s.seq, s.content_hash) for s in segments] != [(r["juan_no"], r["seq"], r["content_hash"])
                                                                for r in rows]:
        print(f"{json_path.name}: source changed since translation, skipped", file=sys.stderr, flush=True)
        return 0, 0, 0.0
    todo = stale_batches(segments, rows, opts.batch_chars)
    chars = sum(len(CJK.findall(segments[i].content_zh)) for span in todo for i in span)
    if dry_run or not todo:
        return len(todo), chars, 0.0

    title = data.get("title_zh") or work_title(xml_path) or json_path.stem
    prompts = ((PROMPT_DIR / "translate.md").read_text(encoding="utf-8"),
               (PROMPT_DIR / "review.md").read_text(encoding="utf-8"))
    usage = Usage()
    for span in todo:
        new_rows = process_batch(opts, prompts, title, [segments[i] for i in span], usage)
        for i, new in zip(span, new_rows):
            if segments[i].source_notes:
                new["translated_without_notes"] = rows[i]["content_vi"]
            rows[i] = new
    for i, seg in enumerate(segments):
        rows[i].setdefault("source_notes", seg.source_notes)

    total = Usage(data.get("usage") or {})
    for name, row in usage.by_model.items():
        target = total.by_model.setdefault(name, {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
        for k in target:
            target[k] += row[k]
    data["usage"] = total.by_model
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    json_path.with_suffix(".md").write_text(
        render_markdown(data["work_code"], title, opts, segments, 0, data.get("elapsed") or 0, total, rows),
        encoding="utf-8")
    write_bilingual_markdown(json_path, data["work_code"], title, rows)
    print(f"{json_path.name}: {len(todo)} batch(es) · {chars:,} chữ · {usage.total_credits():,.0f} credit · "
          f"cần duyệt {sum(1 for r in rows if r['status'] == 'flagged')}", flush=True)
    return len(todo), chars, usage.total_credits()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--canon-dir", required=True)
    ap.add_argument("--workers", type=int, required=True)
    ap.add_argument("--dry-run", action="store_true", help="Only count the batches / characters to redo")
    add_common_args(ap)
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[2]
    load_env(root / ".env")
    opts = options_from(args)
    out_dir = Path(args.out_dir)
    xml = {p.stem: p for p in Path(args.canon_dir).glob("*/*.xml")}
    files = [f for f in sorted(out_dir.glob("*.json"))
             if not f.name.startswith("_") and not f.name.endswith(".partial.json") and f.stem in xml]
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(lambda f: apply(f, xml[f.stem], opts, args.dry_run), files))
    n_batches = sum(r[0] for r in results)
    print(f"{len(files)} works · {sum(1 for r in results if r[0])} with notes · {n_batches} batch(es) · "
          f"{sum(r[1] for r in results):,} chữ · {sum(r[2] for r in results):,.0f} credit", flush=True)


if __name__ == "__main__":
    main()
