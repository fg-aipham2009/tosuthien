#!/usr/bin/env python3
"""Let a model adjudicate sentences still flagged in translated works.

- Finished work ({stem}.json): updates the JSON in place and re-renders {stem}.md.
- Work still in progress ({stem}.partial.json): writes {stem}.adjudication.md only (the running job owns the file).
- A directory: every finished {stem}.json in it that still has flagged sentences; a summary is written to
  --summary when given.

Context for each sentence = the other sentences of the same paragraph. Sentences judged before carry the
earlier verdict to the new model (see adjudicate_rows).

Usage:
    HHTECH_CONFIRM_KEYS_FILE=... python3 scripts/canon/adjudicate_file.py data/cbeta/translations/X \
      --translator claude-opus-5-5 --reviewer gpt-6-astra --adjudicator claude-fable-5-1 \
      --max-attempts 5 --retry-wait 30 --summary data/cbeta/translations/X/_adjudication_fable.md
"""
from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from itertools import groupby
from pathlib import Path

from bilingual_format import write_bilingual_markdown
from translate_work import (HUMAN_JUDGE, SELF_DOUBT_ISSUE, Options, Usage, adjudicate_rows, render_markdown,
                            self_doubted, work_lock)
from cbeta_parser import Segment
from try_translate import load_env

SEGMENT_FIELDS = ("juan_no", "juan_label", "seq", "paragraph_no", "segment_type", "content_zh", "cbeta_ref",
                  "heading_level")


def flagged(rows: list[dict]) -> list[dict]:
    return [r for r in rows if r["status"] == "flagged"]


def was_uncertain(row: dict) -> bool:
    verdicts = [row.get("adjudication") or {}] + row.get("adjudication_history", [])
    return any(v.get("confident") is False for v in verdicts)


def settled_by(row: dict, models: list[str]) -> bool:
    """One of these models already gave its verdict (sure or not); asking again would only repeat the cost.
    A human verdict is final for every model."""
    latest = row.get("adjudication") or {}
    return latest.get("model") in [*models, HUMAN_JUDGE]


def from_level(opts: Options, model: str) -> list[str]:
    """The model and every judge after it in the adjudication order."""
    judges = opts.judges()
    return judges[judges.index(model):] if model in judges else [model]


def targets_of(rows: list[dict], recheck: bool, models: list[str], doubted: bool = False) -> list[dict]:
    """A flagged row the last judge already left unsure needs a human, not another paid call."""
    final = models[-1:] if len(models) > 1 else []
    return [r for r in rows
            if (r["status"] == "flagged" and not settled_by(r, final))
            or (recheck and was_uncertain(r) and not settled_by(r, models))
            or (doubted and self_doubted(r) and not r.get("adjudication"))]


def judge(path: Path, opts: Options, model: str, recheck: bool, doubted: bool = False) -> tuple[list[dict], Usage]:
    if path.name.endswith(".partial.json"):
        return _judge(path, opts, model, recheck, doubted)
    with work_lock(path):
        return _judge(path, opts, model, recheck, doubted)


def _judge(path: Path, opts: Options, model: str, recheck: bool, doubted: bool) -> tuple[list[dict], Usage]:
    data = json.loads(path.read_text(encoding="utf-8"))
    in_progress = path.name.endswith(".partial.json")
    rows = data["results"] if in_progress else data["segments"]
    title = data.get("title_zh") or path.stem
    usage = Usage()

    targets = targets_of(rows, recheck, from_level(opts, model), doubted)
    for r in targets:
        r["status"] = "flagged"
        r["open_issues"] = r.get("open_issues") or [SELF_DOUBT_ISSUE]
    for _, group in groupby(rows, key=lambda r: (r["juan_no"], r["paragraph_no"])):
        paragraph = list(group)
        if any(r["status"] == "flagged" for r in paragraph):
            adjudicate_rows(opts, title, paragraph, paragraph, usage, model=model)
    print(f"{path.name}: flagged {len(targets)} → still flagged {len(flagged(rows))} · "
          f"{usage.total_credits():,.0f} credit", flush=True)

    if in_progress:
        stem = path.name.removesuffix(".partial.json")
        out = path.with_name(f"{stem}.adjudication.md")
        out.write_text(f"# {stem} — {model} thẩm định các câu cần duyệt\n\n"
                       f"- `{model}` · {usage.total_credits():,.0f} credit\n\n" + render_rows(targets),
                       encoding="utf-8")
        print(out)
        return targets, usage

    prior = Usage(data.get("usage") or {})
    for name, row in usage.by_model.items():
        target = prior.by_model.setdefault(name, {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
        for k in target:
            target[k] += row[k]
    data["usage"] = prior.by_model
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    segments = [Segment(**{k: r[k] for k in SEGMENT_FIELDS}) for r in rows]
    md = render_markdown(data["work_code"], title, Options(data["translator"], data["reviewer"], "?", 0, 0),
                         segments, 0, data.get("elapsed") or 0, prior, rows)
    path.with_suffix(".md").write_text(md, encoding="utf-8")
    write_bilingual_markdown(path, data["work_code"], title, rows)
    return targets, usage


def render_rows(rows: list[dict]) -> str:
    lines = []
    for r in rows:
        a = r["adjudication"]
        history = "".join(f"- Lần trước (`{h.get('model', '?')}`): `{h.get('decision')}` — {h.get('reason')}\n"
                          for h in r.get("adjudication_history", []))
        lines.append(f"## [{r['cbeta_ref']}] {r['content_zh']}\n\n- Bản đầu: {a['previous_vi']}\n{history}"
                     f"- Ý kiến soát: {json.dumps(r['open_issues'], ensure_ascii=False)}\n"
                     f"- **Bản chốt:** {r['content_vi']}\n- Quyết định (`{a.get('model')}`): `{a.get('decision')}` · "
                     f"chắc chắn: {a.get('confident')}\n- Lý do: {a.get('reason')}\n")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--translator", required=True)
    ap.add_argument("--reviewer", required=True)
    ap.add_argument("--adjudicator", help="model that judges flagged sentences (default: --translator)")
    ap.add_argument("--max-attempts", type=int, required=True)
    ap.add_argument("--retry-wait", type=int, required=True)
    ap.add_argument("--summary", help="markdown file listing every judged sentence (directory mode)")
    ap.add_argument("--recheck-uncertain", action="store_true",
                    help="also judge sentences any earlier verdict marked not confident")
    ap.add_argument("--arbiter", help="model between the translator and --confirmer in the adjudication order")
    ap.add_argument("--confirmer", help="model that re-judges sentences the adjudicator is still unsure about")
    ap.add_argument("--self-doubted", action="store_true",
                    help="also judge sentences the translator marked [?] (source text intact) that nobody flagged")
    ap.add_argument("--workers", type=int, default=1, help="works judged in parallel (directory mode)")
    args = ap.parse_args()
    load_env(Path(__file__).resolve().parents[2] / ".env")

    opts = Options(args.translator, args.reviewer, batch_chars=0, max_attempts=args.max_attempts,
                   retry_wait=args.retry_wait, confirmer=args.confirmer, arbiter=args.arbiter)
    model = args.adjudicator or args.translator
    path = Path(args.path)
    if not path.is_dir():
        judge(path, opts, model, args.recheck_uncertain, args.self_doubted)
        return

    files = [f for f in sorted(path.glob("*.json"))
             if not f.name.startswith("_") and not f.name.endswith(".partial.json")
             and targets_of(json.loads(f.read_text(encoding="utf-8"))["segments"], args.recheck_uncertain,
                            from_level(opts, model), args.self_doubted)]
    total = Usage()
    sections = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(lambda f: judge(f, opts, model, args.recheck_uncertain, args.self_doubted), files))
    for f, (rows, usage) in zip(files, results):
        for name, row in usage.by_model.items():
            target = total.by_model.setdefault(name, {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
            for k in target:
                target[k] += row[k]
        sections.append(f"# {f.stem}\n\n{render_rows(rows)}")
    still = sum(len(flagged(r)) for r in
                (json.loads(f.read_text(encoding="utf-8"))["segments"] for f in files))
    print(f"{len(files)} works · still flagged {still} · {total.total_credits():,.0f} credit")
    if args.summary:
        Path(args.summary).write_text(
            f"# Thẩm định bằng `{model}`\n\n- {len(files)} bộ · còn cần người duyệt: {still} câu · "
            f"{total.total_credits():,.0f} credit\n\n" + "\n".join(sections), encoding="utf-8")
        print(args.summary)


if __name__ == "__main__":
    main()
