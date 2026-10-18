#!/usr/bin/env python3
"""Re-adjudicate semantic Tier-A rows via official Anthropic Messages API.

Key (outside repo): ~/.config/tosuthien/anthropic_key
List: data/cbeta/translations/X/_claude_official_retry.json

  python3 scripts/canon/retry_official_anthropic.py \
    --list data/cbeta/translations/X/_claude_official_retry.json --tier A \
    --model claude-opus-4-5 --out-dir data/cbeta/translations/X
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from collections import defaultdict
from itertools import groupby
from pathlib import Path

from bilingual_format import write_bilingual_markdown
from cbeta_parser import Segment
from translate_work import PROMPT_DIR, Options, Usage, render_markdown, work_lock
from try_translate import parse_json

SEGMENT_FIELDS = ("juan_no", "juan_label", "seq", "paragraph_no", "segment_type", "content_zh",
                  "cbeta_ref", "heading_level")
DEFAULT_KEY = Path.home() / ".config/tosuthien/anthropic_key"
API = "https://api.anthropic.com/v1/messages"
MODEL_TAG = "anthropic-official"


def load_key(path: Path) -> str:
    key = path.read_text(encoding="utf-8").strip()
    if not key.startswith("sk-ant-"):
        raise SystemExit(f"bad key in {path}")
    return key


def repair_json(text: str) -> dict:
    """Parse model JSON; tolerate unescaped quotes inside Vietnamese string values."""
    try:
        return parse_json(text)
    except json.JSONDecodeError:
        pass
    # Extract {...} and rebuild via regex fields when model left raw " inside strings
    import re
    m = re.search(r"\{.*\}", text, re.S)
    blob = m.group(0) if m else text.strip()
    fields = {}
    for key in ("final", "decision", "reason", "confident"):
        # naive: "key": ... next key or end
        pat = rf'"{key}"\s*:\s*'
        mm = re.search(pat, blob)
        if not mm:
            continue
        i = mm.end()
        if blob[i:i + 4].lower() in ("true", "fals"):
            fields[key] = blob[i:].startswith("true")
            continue
        if blob[i] != '"':
            continue
        i += 1
        buf = []
        while i < len(blob):
            ch = blob[i]
            if ch == "\\" and i + 1 < len(blob):
                buf.append(blob[i:i + 2])
                i += 2
                continue
            if ch == '"':
                # end if followed by , or } (with optional space)
                rest = blob[i + 1:i + 8].lstrip()
                if rest.startswith((",", "}")):
                    break
                # unescaped quote inside string → keep as literal
                buf.append('\\"')
                i += 1
                continue
            buf.append(ch)
            i += 1
        fields[key] = "".join(buf)
    if "final" not in fields:
        raise json.JSONDecodeError("repair failed", text, 0)
    return fields


def anthropic_chat(model: str, system: str, user: str, api_key: str,
                   max_tokens: int = 1024) -> tuple[str, dict, float]:
    system = system.rstrip() + (
        "\n\nOUTPUT: one JSON object only. Escape every \" inside string values as \\\". "
        "No markdown fence, no commentary."
    )
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    req = urllib.request.Request(
        API,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {err[:500]}") from e
    sec = time.time() - t0
    text = "".join(b.get("text", "") for b in data.get("content") or [] if b.get("type") == "text")
    usage = data.get("usage") or {}
    u = {
        "prompt_tokens": usage.get("input_tokens") or 0,
        "completion_tokens": usage.get("output_tokens") or 0,
        "input_tokens": usage.get("input_tokens") or 0,
        "output_tokens": usage.get("output_tokens") or 0,
    }
    return text, u, sec


def context_window(paragraph: list[dict], idx: int, before_n: int, after_n: int) -> tuple[list[str], list[str]]:
    before = [r["content_zh"] for r in paragraph[max(0, idx - before_n):idx]]
    after = [r["content_zh"] for r in paragraph[idx + 1:idx + 1 + after_n]]
    return before, after


def apply_result(row: dict, result: dict, model_label: str) -> None:
    if row.get("adjudication"):
        row["adjudication"].setdefault("model", "prior")
        row.setdefault("adjudication_history", []).append(row["adjudication"])
    row["adjudication"] = {
        "decision": result.get("decision"),
        "reason": result.get("reason"),
        "confident": result.get("confident"),
        "model": model_label,
        "previous_vi": row["content_vi"],
    }
    row["content_vi"] = str(result["final"]).strip()
    if result.get("confident") is not False:
        row["status"] = "ai_checked"
        row["open_issues"] = []
    else:
        row["status"] = "flagged"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", type=Path, required=True)
    ap.add_argument("--out-dir", type=Path, required=True)
    ap.add_argument("--tier", default="A")
    ap.add_argument("--model", default="claude-opus-4-5")
    ap.add_argument("--key-file", type=Path, default=DEFAULT_KEY)
    ap.add_argument("--before", type=int, default=4)
    ap.add_argument("--after", type=int, default=4)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--escalate-from",
        help="Only re-judge rows whose latest model contains this prefix and confident=false "
             "(e.g. claude-sonnet-4-5+anthropic-official)",
    )
    args = ap.parse_args()

    payload = json.loads(args.list.read_text(encoding="utf-8"))
    items = payload["items"]
    if args.tier.lower() != "all":
        items = [i for i in items if i.get("tier") == args.tier]
    if args.limit:
        items = items[: args.limit]
    if not items:
        raise SystemExit("no items")

    api_key = load_key(args.key_file)
    system = (PROMPT_DIR / "adjudicate.md").read_text(encoding="utf-8")
    model_label = f"{args.model}+{MODEL_TAG}"

    by_work: dict[str, list[dict]] = defaultdict(list)
    for it in items:
        by_work[it["work"]].append(it)

    report: dict = {"model": args.model, "model_label": model_label, "tier": args.tier, "rows": []}
    session_usage: dict[str, dict] = defaultdict(lambda: {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
    closed = 0
    still = 0

    print(f"Retry {len(items)} tier-{args.tier} rows · model {args.model} · {len(by_work)} works", flush=True)

    for stem, work_items in sorted(by_work.items()):
        path = args.out_dir / f"{stem}.json"
        if not path.exists():
            print(f"SKIP missing {path.name}", flush=True)
            continue
        want = {(it.get("cbeta_ref"), it.get("seq")) for it in work_items}
        with work_lock(path):
            data = json.loads(path.read_text(encoding="utf-8"))
            rows = data["segments"]
            title = data.get("title_zh") or stem
            touched = 0

            def persist() -> None:
                prior_u = data.setdefault("usage", {})
                path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
                segments = [Segment(**{k: r[k] for k in SEGMENT_FIELDS}) for r in rows]
                md = render_markdown(
                    data["work_code"], title,
                    Options(data["translator"], data["reviewer"], "?", 0, 0),
                    segments, 0, data.get("elapsed") or 0, Usage(prior_u), rows,
                )
                path.with_suffix(".md").write_text(md, encoding="utf-8")
                write_bilingual_markdown(path, data["work_code"], title, rows)

            for _, group in groupby(rows, key=lambda r: (r["juan_no"], r["paragraph_no"])):
                paragraph = list(group)
                for idx, row in enumerate(paragraph):
                    key = (row.get("cbeta_ref"), row.get("seq"))
                    if key not in want:
                        continue
                    before, after = context_window(paragraph, idx, args.before, args.after)
                    prior = row.get("adjudication") or {}
                    user = json.dumps({
                        "work": title,
                        "context_before": before,
                        "context_after": after,
                        "zh": row["content_zh"],
                        "vi": row["content_vi"],
                        "review": row.get("open_issues"),
                        "prior_judgement": {
                            "original_vi": prior.get("previous_vi"),
                            "decision": prior.get("decision"),
                            "reason": prior.get("reason"),
                            "model": prior.get("model"),
                        },
                    }, ensure_ascii=False)
                    latest_adj = row.get("adjudication") or {}
                    latest = latest_adj.get("model") or ""
                    if args.escalate_from:
                        # Sonnet→Opus: only rows the cheaper model left unsure
                        if args.escalate_from not in latest or latest_adj.get("confident") is not False:
                            print(f"{stem} [{row.get('cbeta_ref')}] seq={row.get('seq')} skip (not escalate)",
                                  flush=True)
                            continue
                        if args.model in latest:
                            print(f"{stem} [{row.get('cbeta_ref')}] seq={row.get('seq')} skip (done)", flush=True)
                            continue
                    elif MODEL_TAG in latest:
                        # Resume: skip rows already judged by any official pass
                        print(f"{stem} [{row.get('cbeta_ref')}] seq={row.get('seq')} skip (done)", flush=True)
                        continue
                    print(f"{stem} [{row.get('cbeta_ref')}] seq={row.get('seq')} …", flush=True)
                    if args.dry_run:
                        continue
                    result = None
                    u, sec = {}, 0.0
                    for attempt in range(1, 4):
                        try:
                            raw, u, sec = anthropic_chat(args.model, system, user, api_key)
                            try:
                                result = repair_json(raw)
                            except json.JSONDecodeError:
                                dump = args.out_dir / "_claude_official_retry_bad.jsonl"
                                with dump.open("a", encoding="utf-8") as fh:
                                    fh.write(json.dumps({"work": stem, "ref": row.get("cbeta_ref"),
                                                         "raw": raw}, ensure_ascii=False) + "\n")
                                raise
                            if not str(result.get("final", "")).strip():
                                raise KeyError("empty final")
                            break
                        except (json.JSONDecodeError, KeyError, RuntimeError, ValueError) as err:
                            print(f"  attempt {attempt}/3 failed: {type(err).__name__}: {err}", flush=True)
                            if attempt == 3:
                                raise
                            time.sleep(2 * attempt)
                    assert result is not None
                    apply_result(row, result, model_label)
                    conf = result.get("confident") is not False
                    closed += int(conf)
                    still += int(not conf)
                    touched += 1
                    session_usage[stem]["calls"] += 1
                    session_usage[stem]["in"] += u.get("input_tokens") or 0
                    session_usage[stem]["out"] += u.get("output_tokens") or 0
                    session_usage[stem]["seconds"] += sec
                    # merge usage incrementally so a crash does not lose spend
                    prior_u = data.setdefault("usage", {})
                    acc = prior_u.setdefault(model_label, {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
                    acc["calls"] += 1
                    acc["in"] += u.get("input_tokens") or 0
                    acc["out"] += u.get("output_tokens") or 0
                    acc["seconds"] += sec
                    report["rows"].append({
                        "work": stem,
                        "cbeta_ref": row.get("cbeta_ref"),
                        "seq": row.get("seq"),
                        "decision": result.get("decision"),
                        "confident": result.get("confident"),
                        "final": row["content_vi"],
                        "reason": result.get("reason"),
                        "in": u.get("input_tokens"),
                        "out": u.get("output_tokens"),
                        "sec": round(sec, 2),
                    })
                    print(f"  → {result.get('decision')} confident={result.get('confident')}", flush=True)
                    persist()

            if args.dry_run or not touched:
                continue

    report["closed"] = closed
    report["still_unsure"] = still
    report["usage_by_work"] = dict(session_usage)
    out = args.out_dir / "_claude_official_retry_result.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    tin = sum(u["in"] for u in session_usage.values())
    tout = sum(u["out"] for u in session_usage.values())
    print(f"\nDone: closed {closed} · still unsure {still} · tokens in={tin} out={tout} · {out}", flush=True)


if __name__ == "__main__":
    main()
