#!/usr/bin/env python3
"""Add the source characters of each doubtful spot before its [?] in finished works: "phu lượng (敷量) [?]".

The model may only insert "(…)" right before a [?]; a result is accepted only if removing the inserted
groups gives back the old translation exactly and every inserted group is a substring of the source.
Rows already carrying a source group before every [?] are skipped, so the pass is safe to repeat.

Usage:
    HHTECH_API_KEYS_FILE=... python3 scripts/canon/retrofit_unsure_source.py data/cbeta/translations/X \
      --model gpt-6-astra --rows-per-call 20 --workers 6 --max-attempts 3 --retry-wait 30
"""
from __future__ import annotations

import argparse
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from cbeta_parser import Segment
from bilingual_format import write_bilingual_markdown
from translate_work import (UNSURE_MARK, Options, Usage, render_markdown, with_retry, work_lock)
from try_translate import chat, load_env, parse_json

SEGMENT_FIELDS = ("juan_no", "juan_label", "seq", "paragraph_no", "segment_type", "content_zh", "cbeta_ref",
                  "heading_level")
GROUP = re.compile(r"\s*[（(]([^()（）]+)[)）](?=\s*\[\?\])")
SYSTEM = """Mỗi mục gồm "zh" (nguyên văn chữ Hán) và "vi" (bản dịch có dấu [?] ở chỗ chưa chắc).
Với MỖI dấu [?] trong "vi", chèn ngay trước nó chữ Hán gốc của đúng chỗ chưa chắc, đặt trong ngoặc tròn, chép y nguyên văn "zh" (một hoặc vài chữ liền nhau, không chép cả câu, không thêm dấu câu).
Ví dụ: "lặng phu lượng [?]" → "lặng phu lượng (敷量) [?]".
Nếu [?] đứng cuối câu và chỉ cả câu thì chọn cụm chữ Hán là trọng tâm của chỗ chưa chắc.
Không được sửa, thêm, bớt bất kỳ chữ nào khác của "vi".
ĐẦU RA: chỉ một JSON {"items": [{"n": số, "vi": "bản đã chèn"}]}"""


def needs(row: dict) -> bool:
    vi = row.get("content_vi") or ""
    return vi.count(UNSURE_MARK) > len(GROUP.findall(vi)) and row.get("source_retrofit_failed") != vi


def valid(row: dict, new: str) -> bool:
    old = row["content_vi"]
    if new.count(UNSURE_MARK) != old.count(UNSURE_MARK) or GROUP.sub("", new) != GROUP.sub("", old):
        return False
    groups = GROUP.findall(new)
    return len(groups) == new.count(UNSURE_MARK) and all(g in row["content_zh"] for g in groups)


def call(model: str, rows: list[dict], usage: Usage) -> dict[int, str]:
    payload = [{"n": i + 1, "zh": r["content_zh"], "vi": r["content_vi"]} for i, r in enumerate(rows)]
    raw, u, sec = chat(model, SYSTEM, json.dumps(payload, ensure_ascii=False))
    usage.add(model, u, sec)
    return {int(x["n"]): str(x["vi"]) for x in parse_json(raw)["items"]}


def retrofit(path: Path, opts: Options, args) -> tuple[int, int, Usage]:
    usage = Usage()
    with work_lock(path):
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = data["segments"]
        todo = [r for r in rows if needs(r)]
        if not todo:
            return 0, 0, usage
        chunks = [todo[i:i + args.rows_per_call] for i in range(0, len(todo), args.rows_per_call)]
        def ask(chunk: list[dict]) -> tuple[dict[int, str], Usage]:
            part = Usage()
            try:
                return with_retry(opts, call, args.model, chunk, part), part
            except RuntimeError as err:
                print(f"  {path.stem}: chunk skipped ({err})", flush=True)
                return {}, part

        done = 0
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            answers = list(pool.map(ask, chunks))
        for chunk, (out, part) in zip(chunks, answers):
            for name, u in part.by_model.items():
                acc = usage.by_model.setdefault(name, {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
                for k in acc:
                    acc[k] += u[k]
            for i, r in enumerate(chunk):
                new = out.get(i + 1, "")
                if valid(r, new):
                    r["content_vi"] = new
                    done += 1
                elif out:
                    r["source_retrofit_failed"] = r["content_vi"]
        prior = Usage(data.get("usage") or {})
        for name, u in usage.by_model.items():
            acc = prior.by_model.setdefault(name, {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
            for k in acc:
                acc[k] += u[k]
        data["usage"] = prior.by_model
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        segments = [Segment(**{k: r[k] for k in SEGMENT_FIELDS}) for r in rows]
        md = render_markdown(data["work_code"], data.get("title_zh") or path.stem,
                             Options(data["translator"], data["reviewer"], "?", 0, 0), segments, 0,
                             data.get("elapsed") or 0, prior, rows)
        path.with_suffix(".md").write_text(md, encoding="utf-8")
        write_bilingual_markdown(path, data["work_code"], data.get("title_zh") or path.stem, rows)
    return len(todo), done, usage


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="translations directory")
    ap.add_argument("--model", required=True)
    ap.add_argument("--rows-per-call", type=int, required=True)
    ap.add_argument("--workers", type=int, required=True, help="calls in parallel within a work")
    ap.add_argument("--max-attempts", type=int, required=True)
    ap.add_argument("--retry-wait", type=int, required=True)
    args = ap.parse_args()
    load_env(Path(__file__).resolve().parents[2] / ".env")
    opts = Options(args.model, args.model, batch_chars=0, max_attempts=args.max_attempts,
                   retry_wait=args.retry_wait)
    files = [f for f in sorted(Path(args.path).glob("X*.json")) if not f.name.endswith(".partial.json")
             and any(needs(r) for r in json.loads(f.read_text(encoding="utf-8"))["segments"])]
    total = Usage()
    rows = fixed = 0
    for f in files:
        n, ok, usage = retrofit(f, opts, args)
        rows += n
        fixed += ok
        for name, u in usage.by_model.items():
            acc = total.by_model.setdefault(name, {"calls": 0, "in": 0, "out": 0, "seconds": 0.0})
            for k in acc:
                acc[k] += u[k]
        print(f"{f.stem}: {ok}/{n} row(s) · {usage.total_credits():,.0f} credit", flush=True)
    print(f"{len(files)} works · {fixed}/{rows} rows · {total.total_credits():,.0f} credit", flush=True)


if __name__ == "__main__":
    main()
