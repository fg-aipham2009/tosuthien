#!/usr/bin/env python3
"""Translate a whole canon folder work by work (CBETA number order), skipping files already finished.

Usage:
  HHTECH_API_KEYS_FILE=... HHTECH_CONFIRM_KEYS_FILE=... caffeinate -i python3 scripts/canon/run_canon.py \
      --canon-dir data/cbeta/xml-p5/X --limit 5 --workers 1 \
      --translator claude-opus-5-5 --reviewer gpt-6-astra --confirmer claude-fable-5-1 --batch-chars 1200 \
      --max-attempts 5 --retry-wait 30 --out-dir data/cbeta/translations/X
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from cbeta_parser import work_title
from rmth_lookup import should_skip_new_work, write_skip_marker
from translate_work import StopRequested, add_common_args, options_from, translate_file
from try_translate import load_env


def work_order(path: Path) -> tuple:
    m = re.match(r"^[A-Z]+(\d+)n(\d+)(.*)$", path.stem)
    return (int(m.group(2)), m.group(3), int(m.group(1))) if m else (sys.maxsize, path.stem, 0)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--canon-dir", required=True)
    ap.add_argument("--limit", type=int, help="Number of files to translate in this run (default: all remaining)")
    ap.add_argument("--workers", type=int, required=True)
    ap.add_argument("--in-progress-only", action="store_true",
                    help="Only finish works that already have a checkpoint; start no new work")
    # RMTH skip is off by default (lookups were noisy). Opt in with --rmth-skip if needed.
    ap.add_argument("--rmth-skip", action="store_true",
                    help="Skip brand-new works that already have Vietnamese on rongmotamhon.net")
    ap.add_argument("--no-rmth-skip", action="store_true",
                    help=argparse.SUPPRESS)  # legacy no-op; skip is already off by default
    add_common_args(ap)
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[2]
    load_env(root / ".env")
    opts = options_from(args)
    out_dir = (root / args.out_dir) if not Path(args.out_dir).is_absolute() else Path(args.out_dir)
    files = sorted((root / args.canon_dir).glob("*/*.xml"), key=work_order)
    # Finished (.json) stay untouched. Prior .rmth.json markers are ignored — translate those too.
    unfinished = [f for f in files if not (out_dir / f"{f.stem}.json").exists()]
    # Checkpointed works first, so workers only move on to new works once those are taken.
    started = [f for f in unfinished if (out_dir / f"{f.stem}.partial.json").exists()]

    def pending_batches(path: Path) -> int:
        """Fewest batches left first — close near-done works instead of letting giants block workers."""
        try:
            state = json.loads((out_dir / f"{path.stem}.partial.json").read_text(encoding="utf-8"))
            pending = state.get("pending_batches")
            if isinstance(pending, int):
                return pending
            if isinstance(pending, list):
                return len(pending)
        except (OSError, json.JSONDecodeError, TypeError):
            pass
        return sys.maxsize

    # Near-done partials get the workers; huge leftovers (e.g. X13) wait their turn.
    started = sorted(started, key=lambda p: (pending_batches(p), work_order(p)))
    brand_new = [f for f in unfinished if f not in started]
    remaining = started if args.in_progress_only else started + brand_new
    todo = remaining[: args.limit] if args.limit is not None else remaining
    print(f"{len(files)} files · {len(files) - len(unfinished)} done · {len(unfinished)} remaining · "
          f"{len(started)} partial · {len(brand_new)} new · this run {len(todo)} with {args.workers} worker(s)",
          file=sys.stderr, flush=True)
    if started and args.in_progress_only:
        head = ", ".join(f"{p.stem}(~{pending_batches(p)}b)" for p in todo[: args.workers])
        print(f"  priority (fewest batches left): {head}", file=sys.stderr, flush=True)

    ledger = out_dir / "_runs.jsonl"
    out_dir.mkdir(parents=True, exist_ok=True)

    def run(path: Path) -> dict | None:
        if opts.deadline is not None and time.time() >= opts.deadline:
            return None
        is_partial = (out_dir / f"{path.stem}.partial.json").exists()
        # Opt-in only: never rewrite finished .json or in-progress .partial.json for RMTH.
        if args.rmth_skip and not is_partial:
            title = work_title(path) or path.stem
            hit = should_skip_new_work(path.stem, title, out_dir)
            if hit.get("has_viet"):
                write_skip_marker(out_dir, hit)
                print(f"⏭ {path.stem} {title} · đã có Việt trên RMTH — bỏ qua bộ mới "
                      f"({hit.get('url') or ''})", file=sys.stderr, flush=True)
                return {
                    "file": path.stem, "title": title, "skipped": "rmth_vietnamese",
                    "rmth_url": hit.get("url"), "cjk": 0, "credits": 0, "elapsed": 0, "flagged": 0,
                }
            if hit.get("note"):
                print(f"  {path.stem}: RMTH {hit['note']}", file=sys.stderr, flush=True)
        print(f"▶ {path.stem}", file=sys.stderr, flush=True)
        # A work whose API calls keep failing is resumed from its checkpoint instead of being dropped.
        for attempt in range(1, opts.max_attempts + 1):
            try:
                return translate_file(path, out_dir, opts)
            except RuntimeError as err:
                if "gave up after" not in str(err) or attempt == opts.max_attempts:
                    raise
                wait = opts.retry_wait * attempt * opts.max_attempts
                print(f"  {path.stem}: {err} — resuming in {wait}s ({attempt}/{opts.max_attempts})",
                      file=sys.stderr, flush=True)
                time.sleep(wait)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(run, f): f for f in todo}
        for fut in as_completed(futures):
            path = futures[fut]
            try:
                summary = fut.result()
                if summary is None:
                    continue
                summary["finished_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
                print(f"✔ {summary['file']} {summary['title']} · {summary['cjk']:,} chữ · "
                      f"{summary['credits']:,.0f} credit · {summary['elapsed'] / 60:.1f} phút · "
                      f"cần duyệt {summary['flagged']}", file=sys.stderr, flush=True)
            except StopRequested as stop:
                summary = {"file": path.stem, "paused": str(stop),
                           "finished_at": time.strftime("%Y-%m-%d %H:%M:%S")}
                print(f"⏸ {stop}", file=sys.stderr, flush=True)
            except Exception as err:  # noqa: BLE001
                summary = {"file": path.stem, "error": repr(err),
                           "finished_at": time.strftime("%Y-%m-%d %H:%M:%S")}
                print(f"✘ {path.stem}: {err}", file=sys.stderr, flush=True)
                traceback.print_exc()
                if "all HHTech keys exhausted" in str(err):
                    for pending in futures:
                        pending.cancel()
                    print("✘ all keys exhausted — stopping run", file=sys.stderr, flush=True)
            with ledger.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(summary, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
