#!/usr/bin/env python3
"""Check translations against the CBETA source character by character, independently of cbeta_parser.

Source text = every CJK character in the TEI body, minus what is not reading text (cb:mulu, cb:docNumber,
rdg, pb, figure, cb:fn, non-inline notes); gaiji resolved like the parser does.

  --works : every finished {stem}.json in --out-dir → complete only if its rows' Chinese equals the source
            exactly, every row has a Vietnamese translation, and no row is still flagged. Writes --report (TSV).
  --parser: parse every XML of --canon-dir and require the same exact equality (run after any parser change).

Usage:
  python3 scripts/canon/audit_coverage.py --canon-dir data/cbeta/xml-p5/X --out-dir data/cbeta/translations/X \
      --works --report data/cbeta/translations/X/_audit.tsv
  python3 scripts/canon/audit_coverage.py --canon-dir data/cbeta/xml-p5/X --parser
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from cbeta_parser import CB, TEI, _gaiji_table, parse_file

CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff\U00020000-\U0003ffff]")
NOT_READING = {f"{CB}mulu", f"{CB}docNumber", f"{TEI}rdg", f"{TEI}pb", f"{TEI}figure", f"{CB}fn"}


def source_chars(path: Path) -> str:
    root = ET.parse(path).getroot()
    gaiji = _gaiji_table(root)
    out: list[str] = []

    def rec(node: ET.Element) -> None:
        if node.tag in NOT_READING or (node.tag == f"{TEI}note" and node.get("place") != "inline"):
            return
        if node.tag == f"{TEI}g":
            out.append(node.text or gaiji.get((node.get("ref") or "").lstrip("#"), ""))
            return
        out.append(node.text or "")
        for child in node:
            rec(child)
            out.append(child.tail or "")

    body = root.find(f".//{TEI}body")
    if body is not None:
        rec(body)
    return "".join(CJK.findall("".join(out)))


def first_gaps(src: str, got: str, limit: int) -> list[str]:
    ops = difflib.SequenceMatcher(None, src, got, autojunk=False).get_opcodes()
    return [f"{op}:{src[a1:a2][:20]}" for op, a1, a2, _, _ in ops if op != "equal"][:limit]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--canon-dir", required=True)
    ap.add_argument("--out-dir")
    ap.add_argument("--works", action="store_true")
    ap.add_argument("--parser", action="store_true")
    ap.add_argument("--report")
    ap.add_argument("--show-gaps", type=int, default=3, help="Differences printed per mismatching file")
    args = ap.parse_args()
    canon = Path(args.canon_dir)
    xml_by_stem = {p.stem: p for p in canon.glob("*/*.xml")}

    if args.parser:
        bad = 0
        for stem, path in sorted(xml_by_stem.items()):
            src = source_chars(path)
            got = "".join(CJK.findall("".join(s.content_zh for s in parse_file(path, canon.name))))
            if src != got:
                bad += 1
                print(f"PARSER MISMATCH {stem}: source {len(src):,} / parsed {len(got):,} "
                      f"{first_gaps(src, got, args.show_gaps)}")
        print(f"parser: {len(xml_by_stem)} files · {bad} mismatch")

    if args.works:
        out_dir = Path(args.out_dir)
        lines = ["file\ttitle\tsource_chars\ttranslated_chars\texact\tmissing_vi\tflagged\tcomplete"]
        complete = 0
        works = sorted(p for p in out_dir.glob("*.json") if not p.name.endswith(".partial.json"))
        for path in works:
            data = json.loads(path.read_text(encoding="utf-8"))
            rows = data["segments"]
            src = source_chars(xml_by_stem[path.stem])
            got = "".join(CJK.findall("".join(r["content_zh"] for r in rows)))
            missing_vi = sum(1 for r in rows if not (r.get("content_vi") or "").strip())
            flagged = sum(1 for r in rows if r["status"] == "flagged")
            ok = src == got and not missing_vi and not flagged
            complete += ok
            lines.append(f"{path.stem}\t{data.get('title_zh')}\t{len(src)}\t{len(got)}\t{src == got}\t"
                         f"{missing_vi}\t{flagged}\t{ok}")
            if src != got:
                print(f"GAP {path.stem}: source {len(src):,} / translated {len(got):,} "
                      f"{first_gaps(src, got, args.show_gaps)}")
        print(f"works: {len(works)} finished files · {complete} complete (exact text, all translated, none flagged)")
        if args.report:
            Path(args.report).write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
