#!/usr/bin/env python3
"""Apply reviewer verdicts to flagged rows of finished works; a verdict is final (no model re-judges it).

Verdict file (JSON list):
{"file": stem, "juan_no": int, "seq": int, "reason": str, "final": optional new Vietnamese text}.
juan_no is required (seq alone is reused across juans). Without "final" the current translation is kept.

Usage:
    python3 scripts/canon/apply_human_verdicts.py data/cbeta/translations/X verdicts.json --by "<who decided>"
"""
from __future__ import annotations

import argparse
import json
import time
from collections import defaultdict
from pathlib import Path

from bilingual_format import write_bilingual_markdown
from cbeta_parser import Segment
from translate_work import HUMAN_JUDGE, Options, Usage, render_markdown, work_lock

SEGMENT_FIELDS = ("juan_no", "juan_label", "seq", "paragraph_no", "segment_type", "content_zh", "cbeta_ref",
                  "heading_level")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="translations directory")
    ap.add_argument("verdicts")
    ap.add_argument("--by", required=True, help="who made the decisions (recorded on each row)")
    args = ap.parse_args()

    by_file: dict[str, list[dict]] = defaultdict(list)
    for v in json.loads(Path(args.verdicts).read_text(encoding="utf-8")):
        by_file[v["file"]].append(v)

    for stem, verdicts in sorted(by_file.items()):
        path = Path(args.path) / f"{stem}.json"
        with work_lock(path):
            data = json.loads(path.read_text(encoding="utf-8"))
            rows = data["segments"]
            index = {(r["juan_no"], r["seq"]): r for r in rows}
            for v in verdicts:
                if "juan_no" not in v:
                    raise SystemExit(f"verdict missing juan_no (seq alone is not unique): {v}")
                row = index[(v["juan_no"], v["seq"])]
                if row.get("adjudication"):
                    row.setdefault("adjudication_history", []).append(row["adjudication"])
                row["adjudication"] = {"decision": "ban_moi" if v.get("final") else "giu_ban_dich",
                                       "reason": v["reason"], "confident": True, "model": HUMAN_JUDGE,
                                       "by": args.by, "previous_vi": row["content_vi"],
                                       "at": time.strftime("%Y-%m-%d %H:%M:%S")}
                if v.get("final"):
                    row["content_vi"] = v["final"]
                row["status"] = "ai_checked"
            path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
            segments = [Segment(**{k: r[k] for k in SEGMENT_FIELDS}) for r in rows]
            md = render_markdown(data["work_code"], data.get("title_zh") or stem,
                                 Options(data["translator"], data["reviewer"], "?", 0, 0), segments, 0,
                                 data.get("elapsed") or 0, Usage(data.get("usage") or {}), rows)
            path.with_suffix(".md").write_text(md, encoding="utf-8")
            write_bilingual_markdown(path, data["work_code"], data.get("title_zh") or stem, rows)
            print(f"{stem}: {len(verdicts)} verdict(s) · still flagged {sum(r['status'] == 'flagged' for r in rows)}")


if __name__ == "__main__":
    main()
