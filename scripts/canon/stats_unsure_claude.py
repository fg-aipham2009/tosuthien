#!/usr/bin/env python3
"""After an official-Claude retry run: count settled vs still waiting (semantic only).

Missing-char / textual rows are reported separately and NOT listed as Claude candidates.

  python3 scripts/canon/stats_unsure_claude.py data/cbeta/translations/X
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

TEXTUAL = re.compile(
    r"(chữ .* sai|chép sai|ngoa|thiếu chữ|thừa chữ|疑脫|đọc thành|hầu chắc là|"
    r"hiệu khám|bị chép|lầm chữ|誤|脫|khuyết|佚|闕|mất chữ|không đọc được|"
    r"sai chữ|bản khắc|emend)",
    re.I,
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir", type=Path)
    ap.add_argument("--write", type=Path, help="Optional markdown report path")
    args = ap.parse_args()

    off_ok = off_q = 0
    sem = tex = 0
    by_judge: Counter[str] = Counter()
    candidates: list[dict] = []

    for path in sorted(args.out_dir.glob("X*.json")):
        if path.name.endswith(".partial.json"):
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for row in data.get("segments") or []:
            adj = row.get("adjudication") or {}
            model = adj.get("model") or ""
            if "anthropic-official" in model:
                if adj.get("confident") is False or row.get("status") == "flagged":
                    off_q += 1
                else:
                    off_ok += 1
            if row.get("status") != "flagged" or adj.get("confident") is not False:
                continue
            if "anthropic-official" in model:
                continue
            blob = (adj.get("reason") or "") + " " + json.dumps(row.get("open_issues") or [], ensure_ascii=False)
            if TEXTUAL.search(blob):
                tex += 1
                continue
            sem += 1
            judge = "fable" if "fable" in model else ("astra" if "astra" in model else model or "?")
            by_judge[judge] += 1
            candidates.append({
                "work": path.stem,
                "cbeta_ref": row.get("cbeta_ref"),
                "seq": row.get("seq"),
                "decision": adj.get("decision"),
                "model": model,
            })

    lines = [
        "# Thống kê unsure / Claude official",
        "",
        f"- Claude chính chủ đã chốt: **{off_ok}**",
        f"- Claude chính chủ còn ❓ (đã thử, thôi): **{off_q}**",
        f"- Chờ confirm (nghi nghĩa → có thể đưa Claude): **{sem}**",
        f"- Mất/ngoa chữ (để nguyên, không đưa Claude): **{tex}**",
        f"- Judge còn chờ (semantic): " + ", ".join(f"{k}={v}" for k, v in by_judge.most_common()),
        "",
    ]
    text = "\n".join(lines)
    print(text)
    if args.write:
        args.write.write_text(text + "\n## Ứng viên Claude\n\n"
                              + "\n".join(f"- `{c['work']}` [{c['cbeta_ref']}] seq {c['seq']} · `{c['decision']}`"
                                          for c in candidates),
                              encoding="utf-8")
        print(f"Wrote {args.write} ({len(candidates)} candidates)")


if __name__ == "__main__":
    main()
