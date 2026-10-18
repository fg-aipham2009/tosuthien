"""Shared bilingual reading layout: one Chinese unit, then its Vietnamese, per segment.

Each pair is always the same JSON row: content_zh above content_vi of that row.
Never zip a Chinese list against a separate Vietnamese list (that would misalign meaning).

Units follow CBETA segments (sentence / verse line / heading / item). Punctuation-only
rows append their own zh+vi onto the preceding unit so they are not orphaned.
"""
from __future__ import annotations

import re
from pathlib import Path

LINE_TYPES = ("verse", "byline", "dharani", "item")
PUNCT_ONLY = re.compile(r"[\s\)\]）〕」』》。，、；：！？.,;:!?\"'”’]+")


def bilingual_blocks(rows: list[dict]) -> list[tuple[str, object, str]]:
    """(kind, zh, vi) with kind in juan / heading / para / line, in reading order.

    For "para", zh is the list of (zh, vi) sentence pairs from the same rows,
    and vi the joined Vietnamese (VI-only render).
    """
    blocks: list[tuple[str, object, str]] = []
    pairs: list[tuple[str, str]] = []
    juan = para = None

    def flush() -> None:
        if pairs:
            blocks.append(("para", list(pairs), " ".join(v for _, v in pairs)))
            pairs.clear()

    def attach(zh: str, vi: str) -> None:
        if pairs:
            z0, v0 = pairs[-1]
            pairs[-1] = (z0 + zh, (v0 or "") + (vi or ""))
            return
        kind, prev_zh, prev_vi = blocks[-1]
        if kind == "para":
            pairs_list = list(prev_zh)
            z0, v0 = pairs_list[-1]
            pairs_list[-1] = (z0 + zh, (v0 or "") + (vi or ""))
            blocks[-1] = ("para", pairs_list, " ".join(v for _, v in pairs_list))
        else:
            blocks[-1] = (kind, (prev_zh or "") + zh, (prev_vi or "") + (vi or ""))

    for r in rows:
        zh = r["content_zh"]
        vi = r.get("content_vi") or ""
        if PUNCT_ONLY.fullmatch(zh or "") and (pairs or (blocks and blocks[-1][0] in ("para", "line"))):
            attach(zh, vi)
            continue
        if r["juan_no"] != juan:
            flush()
            blocks.append(("juan", "", f"Quyển {r['juan_label'] or 'tựa'}"))
            juan = r["juan_no"]
        if r["paragraph_no"] != para:
            flush()
            para = r["paragraph_no"]
        if r["segment_type"] == "heading":
            flush()
            blocks.append(("heading", zh, vi))
        elif r["segment_type"] in LINE_TYPES:
            flush()
            blocks.append(("line", zh, vi))
        else:
            pairs.append((zh, vi))
    flush()
    return blocks


def render_bilingual_markdown(work_code: str, title: str, rows: list[dict]) -> str:
    """Readable Hán–Việt markdown: each segment as that row's Chinese then its Vietnamese."""
    lines = [f"# {work_code} {title}\n",
             "Bản song ngữ Hán – Việt (theo câu; mỗi khối Việt là bản dịch của khối Hán ngay trên).\n"]
    for kind, zh, vi in bilingual_blocks(rows):
        if kind == "juan":
            lines.append(f"\n---\n\n## {vi}\n")
        elif kind == "heading":
            lines.append(f"### {zh}\n\n{vi}\n")
        elif kind == "para":
            for z, v in zh:
                lines.append(f"{z}\n\n{v}\n")
        else:  # line
            lines.append(f"{zh}  \n{vi}  \n")
    return "\n".join(lines).rstrip() + "\n"


def write_bilingual_markdown(work_path: Path, work_code: str, title: str, rows: list[dict]) -> Path:
    """Write {stem}.bilingual.md beside a finished {stem}.json / {stem}.md."""
    base = work_path.name
    for tail in (".bilingual.md", ".partial.json", ".json", ".md"):
        if base.endswith(tail):
            base = base[: -len(tail)]
            break
    out = work_path.parent / f"{base}.bilingual.md"
    out.write_text(render_bilingual_markdown(work_code, title, rows), encoding="utf-8")
    return out
