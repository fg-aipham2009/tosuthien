#!/usr/bin/env python3
"""Export every sentence still flagged (Opus/Fable not confident) so it can be handed to another model or a human.

Usage:
  python3 scripts/canon/export_flagged.py data/cbeta/translations/X --out data/cbeta/translations/X/_flagged_export
Writes <out>.md (readable, grouped by work) and <out>.jsonl (one sentence per line, with the full paragraph as context).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def rows_of(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    segments = data.get("segments") or []
    out = []
    for i, seg in enumerate(segments):
        if seg.get("status") != "flagged":
            continue
        paragraph = [s for s in segments
                     if s.get("juan_no") == seg.get("juan_no") and s.get("paragraph_no") == seg.get("paragraph_no")]
        judged = [seg.get("adjudication")] if seg.get("adjudication") else []
        judged += seg.get("adjudication_history") or []
        out.append({
            "file": path.name,
            "work_code": data.get("work_code"),
            "title_zh": data.get("title_zh"),
            "juan": seg.get("juan_label"),
            "cbeta_ref": seg.get("cbeta_ref"),
            "seq": seg.get("seq"),
            "content_zh": seg.get("content_zh"),
            "content_vi": seg.get("content_vi"),
            "source_notes": seg.get("source_notes") or [],
            "open_issues": seg.get("open_issues") or [],
            "adjudication": seg.get("adjudication"),
            "seen_by": sorted({j.get("model") for j in judged if j and j.get("model")}),
            "research_note": seg.get("research_note"),
            "paragraph_zh": "".join(s.get("content_zh") or "" for s in paragraph),
            "paragraph_vi": " ".join(s.get("content_vi") or "" for s in paragraph),
        })
    return out


def render(rows: list[dict], confirmer: str) -> str:
    pending = [r for r in rows if confirmer not in r["seen_by"]]
    lines = ["# Câu còn chờ duyệt", "",
             f"Tổng {len(rows)} câu · chưa qua {confirmer}: {len(pending)} · "
             f"{confirmer} đã xem mà vẫn chưa chắc: {len(rows) - len(pending)}", ""]
    current = None
    for r in rows:
        if r["file"] != current:
            current = r["file"]
            lines += [f"## {r['work_code']} {r['title_zh']} ({r['file']})", ""]
        status = "đã qua " + ", ".join(r["seen_by"]) if r["seen_by"] else "chưa thẩm định"
        lines += [f"### {r['cbeta_ref']} · quyển {r['juan']} · {status}", "",
                  f"- Nguyên văn: {r['content_zh']}",
                  f"- Bản dịch hiện tại: {r['content_vi']}"]
        for note in r["source_notes"]:
            lines.append(f"- Hiệu khám: {note}")
        for issue in r["open_issues"]:
            lines.append(f"- Vấn đề: {issue.get('detail') if isinstance(issue, dict) else issue}")
        if r["adjudication"]:
            lines.append(f"- Lý do ({r['adjudication'].get('model')}): {r['adjudication'].get('reason')}")
        if r["research_note"]:
            lines.append(f"- Ghi chú tra cứu: {r['research_note']}")
        lines += [f"- Cả đoạn (zh): {r['paragraph_zh']}", ""]
    return "\n".join(lines) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("dir", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--confirmer", default="claude-fable-5-1")
    args = ap.parse_args()

    rows = []
    for path in sorted(args.dir.glob("X*.json")):
        rows += rows_of(path)
    args.out.with_suffix(".jsonl").write_text(
        "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    args.out.with_suffix(".md").write_text(render(rows, args.confirmer), encoding="utf-8")
    pending = sum(1 for r in rows if args.confirmer not in r["seen_by"])
    print(f"{len(rows)} flagged sentence(s); not yet seen by {args.confirmer}: {pending}")


if __name__ == "__main__":
    main()
