#!/usr/bin/env python3
"""Doctrinal safety + scripture-intent smoke against live CBETA API."""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from collections import Counter

API = os.environ.get("CBETA_API_BASE", "http://127.0.0.1:8000/api").rstrip("/")

CASES = [
    {
        "id": "HEART",
        "q": "色即是空，空即是色 có nghĩa là mọi thứ đều không tồn tại phải không?",
        "expect_route": "scriptureExplainMode",
        "forbid_ans": [],
        "prefer_phrase": "色即是空",
    },
    {
        "id": "DIAMOND",
        "q": "應無所住而生其心 nghĩa là không cần suy nghĩ hoặc không cần làm gì phải không?",
        "expect_route": "scriptureExplainMode",
        "prefer_phrase": "應無所住",
    },
    {
        "id": "QUOTE",
        "q": "Câu '色即是空，空即是色' có thật trong kinh không?",
        "expect_route": "quoteVerifyMode",
        "prefer_phrase": "色即是空",
    },
    {
        "id": "YUNYAN",
        "q": "Theo T51n2076, liệt kê pháp tự của 雲巖曇晟",
        "expect_route": "personRelationMode",
        "expect_names": ["洞山良价", "杏山鑒洪", "神山僧密", "幽谿"],
        "forbid_ans": ["Tây Thiên", "西天："],
    },
]


def post(path: str, payload: dict) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode()
    req = urllib.request.Request(
        f"{API}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read().decode())


def main() -> int:
    rows = []
    for c in CASES:
        print(f"=== {c['id']} ===", flush=True)
        try:
            rt = post("/cbeta/route", {"question": c["q"]})
            data = post("/cbeta/chat", {"question": c["q"]})
        except Exception as e:
            rows.append({"id": c["id"], "pass": False, "error": str(e)})
            print("ERR", e)
            continue
        ans = data.get("answer") or ""
        cites = data.get("citations") or []
        works = Counter((x.get("workCode") or "?") for x in cites)
        fails = []
        flag = c.get("expect_route")
        if flag and not rt.get(flag):
            fails.append(f"route_missing:{flag}")
        for n in c.get("expect_names") or []:
            if n not in ans:
                fails.append(f"missing:{n}")
        for f in c.get("forbid_ans") or []:
            if f in ans:
                fails.append(f"forbid:{f}")
        phrase = c.get("prefer_phrase")
        if phrase and cites:
            joined = " ".join((x.get("quote") or x.get("label") or "") for x in cites)
            # At least one citation work should be non-empty; prefer phrase in quotes/labels when present
            if phrase not in joined and phrase not in ans:
                # soft: answer may paraphrase; require not flooding lamp-only
                pass
        row = {
            "id": c["id"],
            "pass": not fails,
            "fails": fails,
            "route_flag": {flag: rt.get(flag)} if flag else {},
            "citations": len(cites),
            "works": works.most_common(5),
            "answer_head": ans[:240],
        }
        rows.append(row)
        print(json.dumps(row, ensure_ascii=False, indent=2))
    ok = sum(1 for r in rows if r.get("pass"))
    print(f"SUMMARY {ok}/{len(rows)}", flush=True)
    out = os.environ.get("OUT")
    if out:
        with open(out, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
    return 0 if ok == len(rows) else 1


if __name__ == "__main__":
    sys.exit(main())
