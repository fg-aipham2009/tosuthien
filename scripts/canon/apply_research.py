#!/usr/bin/env python3
"""Merge web/parallel-text research for sentences still flagged after Fable into the finished translations.

Research is collected in <dir>/_research_queue.jsonl (one object per line):
  {"file": "X01n0008", "seq": 857, "cbeta_ref": "0345b13", "note": "...",
   "new_vi": "... (optional, replaces content_vi)", "resolved": true|false}
resolved=true marks the row ai_checked; otherwise it stays flagged for a human, with the note attached.
Refuses to run while adjudicate_file.py is writing the same files.

Usage:
  python3 scripts/canon/apply_research.py data/cbeta/translations/X
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from adjudicate_file import SEGMENT_FIELDS
from cbeta_parser import Segment
from bilingual_format import write_bilingual_markdown
from translate_work import Options, Usage, render_markdown


def busy() -> bool:
    return subprocess.run(["pgrep", "-f", "adjudicate_file.py"], capture_output=True).returncode == 0


def apply(dir_: Path) -> None:
    queue = dir_ / "_research_queue.jsonl"
    entries = [json.loads(line) for line in queue.read_text(encoding="utf-8").splitlines() if line.strip()]
    by_file: dict[str, list[dict]] = {}
    for e in entries:
        by_file.setdefault(e["file"], []).append(e)

    notes_md = dir_ / "_research_notes.md"
    written = notes_md.read_text(encoding="utf-8") if notes_md.exists() else "# Tra cứu thêm cho các câu còn cần người duyệt\n"
    for stem, items in sorted(by_file.items()):
        path = dir_ / f"{stem}.json"
        if not path.exists():
            print(f"skip {stem}: not finished yet", file=sys.stderr)
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = data["segments"]
        changed = 0
        for e in items:
            row = next((r for r in rows if r["seq"] == e["seq"] and r["cbeta_ref"] == e["cbeta_ref"]), None)
            if row is None:
                print(f"skip {stem} seq {e['seq']}: row not found", file=sys.stderr)
                continue
            if e.get("new_vi") and e["new_vi"] != row["content_vi"]:
                row.setdefault("research_previous_vi", row["content_vi"])
                row["content_vi"] = e["new_vi"]
            row["research_note"] = e["note"]
            if e.get("resolved"):
                row["status"] = "ai_checked"
            changed += 1
            header = f"## {stem} [{e['cbeta_ref']}]"
            if header not in written:
                written += f"\n{header}\n\n{e['note']}\n"
        if not changed:
            continue
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        segments = [Segment(**{k: r[k] for k in SEGMENT_FIELDS}) for r in rows]
        md = render_markdown(data["work_code"], data.get("title_zh") or stem,
                             Options(data["translator"], data["reviewer"], "?", 0, 0),
                             segments, 0, data.get("elapsed") or 0, Usage(data.get("usage") or {}), rows)
        path.with_suffix(".md").write_text(md, encoding="utf-8")
        write_bilingual_markdown(path, data["work_code"], data.get("title_zh") or stem, rows)
        print(f"{stem}: {changed} row(s) updated")
    notes_md.write_text(written, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("dir", type=Path)
    args = ap.parse_args()
    if busy():
        sys.exit("adjudicate_file.py is running on these files; apply after it finishes")
    apply(args.dir)


if __name__ == "__main__":
    main()
