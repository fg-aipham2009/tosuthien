#!/usr/bin/env python3
"""Review finished works again with --reviewer and send what it flags through the adjudication chain.

Used for works partly reviewed by another model. Each stem is handled once its {stem}.json exists
(polling every --poll seconds), under the work lock shared with adjudicate_file.py / supplement_finished.py.
A newly flagged row starts the chain afresh (translator → arbiter → confirmer); its earlier verdict moves to
adjudication_history. The reviewer is recorded in "rereviewed_by" so a work is never reviewed twice.

Usage:
  HHTECH_API_KEYS_FILE=... HHTECH_CONFIRM_KEYS_FILE=... python3 scripts/canon/rereview_finished.py \
      --only X04n0223 X09n0240 ... --poll 300 --batch-workers 4 \
      --translator claude-opus-5-5 --reviewer gpt-6-astra --arbiter gpt-6-astra --confirmer claude-fable-5-1 \
      --batch-chars 1200 --max-attempts 5 --retry-wait 30 --out-dir data/cbeta/translations/X
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from itertools import groupby
from pathlib import Path

from cbeta_parser import Segment
from translate_work import (HUMAN_JUDGE, PROMPT_DIR, Options, Usage, add_common_args, adjudicate_rows, batches,
                            options_from, render_markdown, review_batch, with_retry, work_lock)
from bilingual_format import write_bilingual_markdown
from try_translate import load_env

SEGMENT_FIELDS = ("juan_no", "juan_label", "seq", "paragraph_no", "segment_type", "content_zh", "cbeta_ref",
                  "heading_level")


def merge(total: Usage, part: Usage) -> None:
    for model, row in part.by_model.items():
        acc = total.by_model.setdefault(model, {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
        for k in acc:
            acc[k] += row[k]


def rereview(path: Path, opts: Options) -> dict:
    with work_lock(path):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("rereviewed_by") == opts.reviewer:
            return {"file": path.stem, "skipped": True}
        rows = data["segments"]
        title = data.get("title_zh") or path.stem
        segments = [Segment(**{k: r[k] for k in SEGMENT_FIELDS}) for r in rows]
        position = {id(s): i for i, s in enumerate(segments)}
        system = (PROMPT_DIR / "review.md").read_text(encoding="utf-8")

        def review(batch: list[Segment]) -> tuple[list[tuple[int, dict]], Usage]:
            usage = Usage()
            vi = {str(k + 1): rows[position[id(s)]]["content_vi"] for k, s in enumerate(batch)}
            issues = with_retry(opts, review_batch, opts.reviewer, system, batch, vi, usage)
            found = []
            for issue in issues:
                n = str(issue.get("n"))
                if n.isdigit() and 1 <= int(n) <= len(batch):
                    found.append((position[id(batch[int(n) - 1])], issue))
            return found, usage

        total = Usage()
        with ThreadPoolExecutor(max_workers=opts.batch_workers) as pool:
            reviewed = list(pool.map(review, batches(segments, opts.batch_chars)))
        flagged: dict[int, list[dict]] = {}
        for found, usage in reviewed:
            merge(total, usage)
            for i, issue in found:
                flagged.setdefault(i, []).append(issue)

        for i, issues in flagged.items():
            row = rows[i]
            if (row.get("adjudication") or {}).get("model") == HUMAN_JUDGE:
                continue
            if row.get("adjudication"):
                row.setdefault("adjudication_history", []).append(row.pop("adjudication"))
            row["status"] = "flagged"
            row["open_issues"] = issues

        paragraphs = [list(g) for _, g in groupby(rows, key=lambda r: (r["juan_no"], r["paragraph_no"]))]
        todo = [p for p in paragraphs if any(r["status"] == "flagged" for r in p)]

        def judge(paragraph: list[dict]) -> Usage:
            usage = Usage()
            adjudicate_rows(opts, title, paragraph, paragraph, usage)
            return usage

        with ThreadPoolExecutor(max_workers=opts.batch_workers) as pool:
            for usage in pool.map(judge, todo):
                merge(total, usage)

        prior = Usage(data.get("usage") or {})
        merge(prior, total)
        data["usage"] = prior.by_model
        data["rereviewed_by"] = opts.reviewer
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        md = render_markdown(data["work_code"], title, Options(data["translator"], data["reviewer"], "?", 0, 0),
                             segments, 0, data.get("elapsed") or 0, prior, rows)
        path.with_suffix(".md").write_text(md, encoding="utf-8")
        write_bilingual_markdown(path, data["work_code"], title, rows)
        still = sum(1 for r in rows if r["status"] == "flagged")
        return {"file": path.stem, "rereview": opts.reviewer, "newly_flagged": len(flagged), "still_flagged": still,
                "credits": total.total_credits(), "finished_at": time.strftime("%Y-%m-%d %H:%M:%S")}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="+", required=True, help="Stems to review again")
    ap.add_argument("--poll", type=int, required=True, help="Seconds between checks for works not finished yet")
    add_common_args(ap)
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[2]
    load_env(root / ".env")
    opts = options_from(args)
    out_dir = (root / args.out_dir) if not Path(args.out_dir).is_absolute() else Path(args.out_dir)
    ledger = out_dir / "_runs.jsonl"

    pending = list(args.only)
    while pending:
        for stem in [s for s in pending if (out_dir / f"{s}.json").exists()]:
            try:
                summary = rereview(out_dir / f"{stem}.json", opts)
                print(f"✔ rereview {stem} · {summary}", file=sys.stderr, flush=True)
            except Exception as err:  # noqa: BLE001
                summary = {"file": stem, "rereview": opts.reviewer, "error": repr(err),
                           "finished_at": time.strftime("%Y-%m-%d %H:%M:%S")}
                print(f"✘ rereview {stem}: {err}", file=sys.stderr, flush=True)
                continue
            pending.remove(stem)
            with ledger.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(summary, ensure_ascii=False) + "\n")
        if pending:
            print(f"  waiting for {len(pending)} work(s): {' '.join(pending)}", file=sys.stderr, flush=True)
            time.sleep(args.poll)


if __name__ == "__main__":
    main()
