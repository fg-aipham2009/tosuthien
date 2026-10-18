#!/usr/bin/env python3
"""Render a finished translation ({stem}.json) as a reading PDF via headless Chrome.

--bilingual puts each segment's Chinese above that same segment's Vietnamese
(sentence / heading / verse / item). Never cross-pairs meanings across rows.

Usage:
  python3 scripts/canon/export_pdf.py data/cbeta/translations/X/X01n0005.json \
      --title-vi "Vô Lượng Thọ Kinh Hội Dịch" --out data/cbeta/translations/X/pdf/X01n0005.pdf [--bilingual]
Chrome path: CHROME_BIN env, else the default macOS install.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import subprocess
import tempfile
from pathlib import Path

from bilingual_format import bilingual_blocks

DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CSS = """
@page { size: A4; margin: 22mm 20mm; }
body { font-family: "Times New Roman", "Songti SC", "STSong", serif; font-size: 12.5pt; line-height: 1.6; color: #111; }
.cover { text-align: center; page-break-after: always; padding-top: 70mm; }
.cover h1 { font-size: 26pt; margin: 0 0 8mm; }
.cover .zh { font-size: 18pt; margin-bottom: 30mm; }
.cover .meta { font-size: 10.5pt; color: #444; line-height: 1.7; }
h2 { font-size: 17pt; text-align: center; page-break-before: always; margin: 0 0 8mm; }
h2.first { page-break-before: avoid; }
h3 { font-size: 14pt; margin: 9mm 0 4mm; page-break-after: avoid; }
h3 .zh { display: block; font-size: 13pt; font-weight: normal; color: #333; }
p { text-align: justify; margin: 0 0 3.5mm; text-indent: 1.5em; }
p.line { text-indent: 0; margin: 0 0 1mm 2em; text-align: left; }
.para { margin: 0 0 7mm; }
.pair { margin: 0 0 3mm; page-break-inside: avoid; }
.pair .zh { font-family: "Songti SC", "STSong", serif; font-size: 12pt; color: #444; text-indent: 0; margin: 0 0 0.8mm; }
.pair .vi { text-indent: 0; margin: 0; }
.pair.line .zh, .pair.line .vi { text-indent: 0; margin-left: 2em; text-align: left; }
.pair.line { margin-bottom: 2mm; }
"""


def to_html(blocks: list[tuple[str, object, str]], bilingual: bool) -> str:
    out, first = [], True
    esc = html.escape
    for kind, zh, vi in blocks:
        if kind == "juan":
            out.append(f'<h2{" class=first" if first else ""}>{esc(vi)}</h2>')
            first = False
        elif kind == "heading":
            out.append(f'<h3>{f"<span class=zh>{esc(zh)}</span>" if bilingual else ""}{esc(vi)}</h3>')
        elif bilingual and kind == "para":
            out.append('<div class="para">' + "".join(
                f'<div class="pair"><p class="zh">{esc(z)}</p><p class="vi">{esc(v)}</p></div>'
                for z, v in zh) + "</div>")
        elif bilingual:
            out.append(f'<div class="pair line"><p class="zh">{esc(zh)}</p><p class="vi">{esc(vi)}</p></div>')
        else:
            out.append(f'<p{" class=line" if kind == "line" else ""}>{esc(vi)}</p>')
    return "\n".join(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("json", type=Path)
    ap.add_argument("--title-vi", required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--bilingual", action="store_true")
    args = ap.parse_args()

    data = json.loads(args.json.read_text(encoding="utf-8"))
    esc = html.escape
    edition = "Bản song ngữ Hán – Việt · " if args.bilingual else ""
    cover = (f'<div class="cover"><h1>{esc(args.title_vi)}</h1>'
             f'<div class="zh">{esc(data.get("title_zh") or "")}</div>'
             f'<div class="meta">CBETA {esc(data["work_code"])} · Vạn Tân Toản Tục Tạng Kinh<br>'
             f'{edition}Bản dịch AI ({esc(data["translator"])} dịch, {esc(data["reviewer"])} soát)<br>'
             f'Nguyên văn: CBETA Chinese Electronic Tripitaka Collection, giấy phép CC BY-NC-SA</div></div>')
    doc = (f'<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>{CSS}</style></head>'
           f'<body>{cover}{to_html(bilingual_blocks(data["segments"]), args.bilingual)}</body></html>')

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as fh:
        fh.write(doc)
    chrome = os.environ.get("CHROME_BIN", DEFAULT_CHROME)
    subprocess.run([chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={args.out.resolve()}", f"file://{fh.name}"],
                   check=True, capture_output=True)
    os.unlink(fh.name)
    print(args.out)


if __name__ == "__main__":
    main()
