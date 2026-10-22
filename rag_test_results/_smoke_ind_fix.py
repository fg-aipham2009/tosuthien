#!/usr/bin/env python3
"""Smoke previously failing independent cases against live API."""
from __future__ import annotations

import json
import os
import time
import urllib.request

API = os.environ.get("CBETA_API_BASE", "http://127.0.0.1:8000/api").rstrip("/")

CASES = [
    ("IND05", "天目山明覺禪師 thuộc 見錄 hay 不錄 trong mục 56 pháp tự Mã Tổ?"),
    ("IND26", "Có phải mọi pháp tự Mã Tổ đều có ngữ lục 見錄 không?"),
    ("IND14", "Thiền sư FakeMaster999 có trong 馬祖法嗣 không?"),
    ("IND12", "Cạnh 百丈懷海 → 黃檗希運 cần citation work_code."),
    ("IND01", "Trong T51n2076, cbeta_ref p.0256c07 thuộc quyển mấy và mục nào?"),
    ("IND16", "Bách Trượng Hoài Hải theo CBETA là pháp tự của ai?"),
    ("IND17", "Triệu Châu Tùng Thẩm thầy là ai theo truyền đăng?"),
]


def chat(question: str, timeout: float = 180) -> tuple[str, dict | None, int]:
    t0 = time.time()
    req = urllib.request.Request(
        f"{API}/cbeta/chat/stream",
        data=json.dumps({"question": question}).encode(),
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
        method="POST",
    )
    ans = ""
    meta = None
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
                    if p.get("type") == "delta":
                        ans += str(p.get("text") or "")
                    if p.get("type") == "done" and p.get("answer"):
                        ans = str(p.get("answer"))
                    if p.get("type") == "meta":
                        meta = p.get("meta") or p
    return ans, meta, int((time.time() - t0) * 1000)


def main() -> None:
    print(f"smoke vs {API}")
    for iid, q in CASES:
        ans, meta, ms = chat(q)
        route = (meta or {}).get("route") or {}
        print("=" * 50)
        print(
            iid,
            f"{ms}ms",
            "sectionList=",
            route.get("sectionListMode"),
            "path=",
            route.get("path"),
        )
        for n in [
            "0256c07",
            "馬祖法嗣",
            "天目山明覺",
            "43",
            "13",
            "不錄",
            "見錄",
            "FakeMaster",
            "không thấy",
            "黃檗",
            "百丈",
            "馬祖",
            "趙州",
            "南泉",
            "嗣",
            "Kết luận",
        ]:
            if n in ans:
                print("  HIT", n)
        print(ans[:400].replace("\n", " | "))
        print()


if __name__ == "__main__":
    main()
