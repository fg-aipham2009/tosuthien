#!/usr/bin/env python3
"""Acceptance smoke: Caodong school lineage (not coverage dump)."""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.request

API = os.environ.get("CBETA_API_BASE", "https://demo.tosuthien.net/api").rstrip("/")
Q = "Liệt kê các vị Tổ theo dòng truyền thừa của tông Tào Động"


def chat(question: str, timeout: float = 300) -> dict:
    t0 = time.time()
    req = urllib.request.Request(
        f"{API}/cbeta/chat/stream",
        data=json.dumps({"question": question}).encode(),
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
        method="POST",
    )
    ans = ""
    meta = None
    route = None
    cites = []
    err = None
    with urllib.request.urlopen(req, timeout=timeout) as res:
        buf = b""
        while True:
            chunk = res.read(8192)
            if not chunk:
                break
            buf += chunk
            while b"\n\n" in buf:
                block, buf = buf.split(b"\n\n", 1)
                for ln in block.decode("utf-8", "replace").split("\n"):
                    if not ln.startswith("data:"):
                        continue
                    try:
                        p = json.loads(ln[5:].strip())
                    except json.JSONDecodeError:
                        continue
                    if p.get("type") == "error":
                        err = p
                    if p.get("type") == "meta":
                        m = p.get("meta") or p
                        meta = {**(meta or {}), **m}
                        if m.get("route"):
                            route = m["route"]
                    if p.get("type") == "citations":
                        cites = p.get("citations") or cites
                    if p.get("type") == "done":
                        if p.get("answer"):
                            ans = str(p.get("answer"))
                        if p.get("citations"):
                            cites = p.get("citations") or cites
                        if p.get("meta"):
                            meta = {**(meta or {}), **(p.get("meta") or {})}
                            if (p.get("meta") or {}).get("route"):
                                route = p["meta"]["route"]
                    if p.get("type") == "delta":
                        ans += str(p.get("text") or "")
    if route and meta is not None:
        meta["route"] = route
    elif route:
        meta = {"route": route}
    return {
        "answer": ans,
        "meta": meta,
        "citations": cites,
        "error": err,
        "latency_ms": int((time.time() - t0) * 1000),
    }


def main() -> int:
    print(f"API={API}")
    print(f"Q={Q}")
    r = chat(Q)
    ans = r["answer"] or ""
    route = (r.get("meta") or {}).get("route") or {}
    print(f"latency_ms={r['latency_ms']} ans_len={len(ans)} cites={len(r.get('citations') or [])}")
    print(
        "route",
        {
            "coverageMode": route.get("coverageMode"),
            "schoolLineageMode": route.get("schoolLineageMode"),
            "path": route.get("path"),
            "reasons": route.get("reasons"),
        },
    )
    if r.get("error"):
        print("ERROR", r["error"])
        return 2

    checks = {
        "not_coverage_dump": not (
            "Phụ lục" in ans and "tần suất" in ans and ans.count("\n") > 500
        ),
        "not_xitian_dump": "Tây Thiên" not in ans and "西天" not in ans[:800],
        "mentions_caodong": "曹洞" in ans or "Tào Động" in ans or "tào động" in ans.lower(),
        "has_dongshan": "洞山" in ans,
        "has_caoshan_or_yunju": "曹山" in ans or "雲居" in ans,
        "has_succession_marker": bool(
            re.search(r"嗣|法嗣|下第|truyền|pháp tự|thầy|trò", ans)
        ),
        "has_cbeta_cite_signal": bool(
            re.search(r"T\d{1,3}n\d{3,5}|景德|五燈|禪燈|傳燈|CBETA|cbeta_ref|quyển|卷", ans)
        ),
        "school_mode": route.get("schoolLineageMode") is True
        or (
            route.get("coverageMode") is not True
            and "mode=schoolLineage" in str(route.get("scopeNote") or "")
        )
        or (
            # Stream done meta may omit route; content already proves non-coverage.
            route.get("schoolLineageMode") is None
            and route.get("coverageMode") is None
            and "曹洞" in ans
            and "洞山" in ans
        ),
        "reasonable_length": 800 <= len(ans) <= 40_000,
    }
    for k, v in checks.items():
        print(f"  {'PASS' if v else 'FAIL'} {k}")

    # Branch structure soft check
    branch_ok = ("曹山" in ans and "雲居" in ans) or (
        "曹山" in ans and ("nhánh" in ans.lower() or "chi" in ans.lower() or "branch" in ans.lower())
    )
    print(f"  {'PASS' if branch_ok else 'SOFT_FAIL'} both_caoshan_and_yunju_or_branch_language")

    print("--- answer head ---")
    print(ans[:2000])
    print("--- answer tail ---")
    print(ans[-600:])

    hard = all(checks.values())
    print("VERDICT", "PASS" if hard and branch_ok else ("SOFT_PASS" if hard else "FAIL"))
    return 0 if hard else 1


if __name__ == "__main__":
    sys.exit(main())
