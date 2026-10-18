#!/usr/bin/env python3
"""One pass over rows the last judge (--confirmer) left unsure: look the sentence up in the local CBETA corpus
and let --confirmer judge it once more with the parallel passages as evidence.

- Only rows still flagged whose latest verdict is from --confirmer, never checked this way before.
- Rows with no parallel passage are not sent to any model.
- Every row handled is marked "parallels_checked", so the pass never repeats on it.
- Rows still unsure afterwards are listed in --report for a human reviewer.

Usage:
    HHTECH_API_KEYS_FILE=... HHTECH_CONFIRM_KEYS_FILE=... python3 scripts/canon/resolve_with_parallels.py \
      data/cbeta/translations/X --canon-dir data/cbeta/xml-p5/X --cache-dir ~/.cache/tosuthien/cbeta_plain/X \
      --translator claude-opus-5-5 --reviewer gpt-6-astra --confirmer claude-fable-5-1 \
      --window 8 --context 40 --max-parallels 6 --workers 4 --max-attempts 3 --retry-wait 60 \
      --report data/cbeta/translations/X/_uncertain_review.md
"""
from __future__ import annotations

import argparse
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from itertools import groupby
from pathlib import Path

from cbeta_parser import Segment
from bilingual_format import write_bilingual_markdown
from translate_work import PROMPT_DIR, Options, Usage, adjudicate, render_markdown, with_retry, work_lock
from try_translate import load_env

SEGMENT_FIELDS = ("juan_no", "juan_label", "seq", "paragraph_no", "segment_type", "content_zh", "cbeta_ref",
                  "heading_level")
CJK = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\U00020000-\U0003134f]")
HEADER = re.compile(r"<teiHeader>.*?</teiHeader>", re.S)
TAG = re.compile(r"<[^>]+>")


def cjk_only(text: str) -> str:
    return "".join(CJK.findall(text))


def load_corpus(canon_dir: Path, cache_dir: Path) -> dict[str, str]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    corpus = {}
    for xml in sorted(canon_dir.glob("*/*.xml")):
        cached = cache_dir / f"{xml.stem}.txt"
        if not cached.exists() or cached.stat().st_mtime < xml.stat().st_mtime:
            raw = xml.read_text(encoding="utf-8")
            cached.write_text(cjk_only(TAG.sub("", HEADER.sub("", raw))), encoding="utf-8")
        corpus[xml.stem] = cached.read_text(encoding="utf-8")
    return corpus


def parallels(zh: str, own: str, corpus: dict[str, str], window: int, context: int, limit: int) -> list[dict]:
    query = cjk_only(zh)
    if len(query) < window:
        return []
    found: list[dict] = []
    seen: dict[str, list[int]] = {}
    for offset in range(0, len(query) - window + 1, max(1, window // 2)):
        probe = query[offset:offset + window]
        for stem, text in corpus.items():
            if stem == own:
                continue
            pos = text.find(probe)
            while pos != -1:
                start = max(0, pos - offset - context)
                if all(abs(start - s) > context for s in seen.get(stem, [])):
                    seen.setdefault(stem, []).append(start)
                    found.append({"work": stem, "text": text[start:pos - offset + len(query) + context]})
                    if len(found) >= limit:
                        return found
                pos = text.find(probe, pos + 1)
    return found


def resolve(path: Path, opts: Options, corpus: dict[str, str], args) -> list[dict]:
    with work_lock(path):
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = data["segments"]
        targets = [r for r in rows if r["status"] == "flagged" and not r.get("parallels_checked")
                   and (r.get("adjudication") or {}).get("model") == opts.confirmer]
        if not targets:
            return []
        title = data.get("title_zh") or path.stem
        paragraph_of = {}
        for _, group in groupby(rows, key=lambda r: (r["juan_no"], r["paragraph_no"])):
            paragraph = list(group)
            for r in paragraph:
                paragraph_of[id(r)] = paragraph
        system = (PROMPT_DIR / "adjudicate.md").read_text(encoding="utf-8")

        def judge(row: dict) -> Usage:
            usage = Usage()
            row["parallels"] = parallels(row["content_zh"], path.stem, corpus, args.window, args.context,
                                         args.max_parallels)
            if not row["parallels"]:
                row["parallels_checked"] = time.strftime("%Y-%m-%d %H:%M:%S")
                return usage
            paragraph = paragraph_of[id(row)]
            i = paragraph.index(row)
            try:
                result = with_retry(opts, adjudicate, opts.confirmer, system, title, row,
                                    [r["content_zh"] for r in paragraph[:i]],
                                    [r["content_zh"] for r in paragraph[i + 1:]], usage, "confirm")
            except Exception as e:
                # Left unchecked so the next pass retries once confirm keys are available again.
                print(f"  {path.stem} [{row['cbeta_ref']}] confirm skipped: {e}", flush=True)
                return usage
            row["parallels_checked"] = time.strftime("%Y-%m-%d %H:%M:%S")
            row.setdefault("adjudication_history", []).append(row["adjudication"])
            row["adjudication"] = {k: result.get(k) for k in ("decision", "reason", "confident")}
            row["adjudication"]["model"] = opts.confirmer
            row["adjudication"]["previous_vi"] = row["content_vi"]
            row["content_vi"] = str(result["final"]).strip()
            if result.get("confident") is not False:
                row["status"] = "ai_checked"
            return usage

        total = Usage()
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            for usage in pool.map(judge, targets):
                for name, u in usage.by_model.items():
                    acc = total.by_model.setdefault(name, {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
                    for k in acc:
                        acc[k] += u[k]

        prior = Usage(data.get("usage") or {})
        for name, u in total.by_model.items():
            acc = prior.by_model.setdefault(name, {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
            for k in acc:
                acc[k] += u[k]
        data["usage"] = prior.by_model
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        segments = [Segment(**{k: r[k] for k in SEGMENT_FIELDS}) for r in rows]
        md = render_markdown(data["work_code"], title, Options(data["translator"], data["reviewer"], "?", 0, 0),
                             segments, 0, data.get("elapsed") or 0, prior, rows)
        path.with_suffix(".md").write_text(md, encoding="utf-8")
        write_bilingual_markdown(path, data["work_code"], title, rows)
        settled = sum(1 for r in targets if r["status"] != "flagged")
        with_parallels = sum(1 for r in targets if r["parallels"])
        print(f"{path.name}: {len(targets)} row(s) · {with_parallels} with parallels · {settled} settled · "
              f"{total.total_credits():,.0f} credit", flush=True)
        return targets


def render_report(items: list[tuple[str, dict]]) -> str:
    out = [f"# Câu cần người duyệt ({len(items)} câu)\n"]
    for stem, r in items:
        a = r.get("adjudication") or {}
        par = "".join(f"  - `{p['work']}`: {p['text']}\n" for p in r.get("parallels") or []) or "  - (không tìm thấy)\n"
        out.append(f"## {stem} [{r['cbeta_ref']}]\n\n- Nguyên văn: {r['content_zh']}\n- Bản dịch hiện tại: "
                   f"{r['content_vi']}\n- Lý do chưa chắc (`{a.get('model')}`): {a.get('reason')}\n"
                   f"- Đoạn song song trong CBETA:\n{par}")
    return "\n".join(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="translations directory")
    ap.add_argument("--canon-dir", required=True)
    ap.add_argument("--cache-dir", required=True, help="plain-text copy of the canon (CJK characters only)")
    ap.add_argument("--translator", required=True)
    ap.add_argument("--reviewer", required=True)
    ap.add_argument("--confirmer", required=True)
    ap.add_argument("--window", type=int, required=True, help="characters per search probe")
    ap.add_argument("--context", type=int, required=True, help="characters kept around each parallel passage")
    ap.add_argument("--max-parallels", type=int, required=True, help="parallel passages sent per sentence")
    ap.add_argument("--workers", type=int, required=True)
    ap.add_argument("--max-attempts", type=int, required=True)
    ap.add_argument("--retry-wait", type=int, required=True)
    ap.add_argument("--report", required=True)
    args = ap.parse_args()
    load_env(Path(__file__).resolve().parents[2] / ".env")

    opts = Options(args.translator, args.reviewer, batch_chars=0, max_attempts=args.max_attempts,
                   retry_wait=args.retry_wait, confirmer=args.confirmer)
    corpus = load_corpus(Path(args.canon_dir), Path(args.cache_dir).expanduser())
    print(f"corpus: {len(corpus)} works · {sum(map(len, corpus.values())):,} characters", flush=True)

    out_dir = Path(args.path)
    for f in sorted(out_dir.glob("X*.json")):
        if not f.name.endswith(".partial.json"):
            resolve(f, opts, corpus, args)

    left = []
    for f in sorted(out_dir.glob("X*.json")):
        if f.name.endswith(".partial.json"):
            continue
        for r in json.loads(f.read_text(encoding="utf-8"))["segments"]:
            if r["status"] == "flagged" and r.get("parallels_checked"):
                left.append((f.stem, r))
    Path(args.report).write_text(render_report(left), encoding="utf-8")
    print(f"still unsure: {len(left)} → {args.report}", flush=True)


if __name__ == "__main__":
    main()
