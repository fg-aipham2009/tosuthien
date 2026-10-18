#!/usr/bin/env python3
"""Render a readable preview ({stem}.preview.md) of a work that is still being translated.

Usage:
  python3 scripts/canon/preview_partial.py data/cbeta/translations/X/X01n0008.partial.json
"""
import json
import sys
from pathlib import Path

from translate_work import Options, Usage, render_markdown
from cbeta_parser import Segment


def main() -> None:
    partial = Path(sys.argv[1])
    state = json.loads(partial.read_text(encoding="utf-8"))
    results = state["results"]
    segments = [Segment(**{k: r[k] for k in ("juan_no", "juan_label", "seq", "paragraph_no", "segment_type",
                                             "content_zh", "cbeta_ref", "heading_level")}) for r in results]
    stem = partial.name.removesuffix(".partial.json")
    usage = Usage(state.get("usage"))
    translator, reviewer = list(usage.by_model)[:2]
    opts = Options(translator, reviewer, batch_chars="?", max_attempts=0, retry_wait=0)
    md = render_markdown(f"{stem} (đang dịch, {state['done_batches']} lượt đã xong)", "", opts, segments,
                         state["done_batches"], state.get("elapsed", 0), usage, results)
    out = partial.with_name(f"{stem}.preview.md")
    out.write_text(md, encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
