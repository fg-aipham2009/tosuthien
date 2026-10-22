#!/usr/bin/env python3
import json
import os
import urllib.request

API = os.environ.get("CBETA_API_BASE", "http://127.0.0.1:8000/api").rstrip("/")
CASES = [
    ("IND01", "Trong T51n2076, cbeta_ref p.0256c07 thuộc quyển mấy và mục nào?"),
    ("IND16", "Bách Trượng Hoài Hải theo CBETA là pháp tự của ai?"),
    ("IND17", "Triệu Châu Tùng Thẩm thầy là ai theo truyền đăng?"),
]

for iid, q in CASES:
    req = urllib.request.Request(
        f"{API}/cbeta/chat/stream",
        data=json.dumps({"question": q}).encode(),
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
        method="POST",
    )
    events = []
    ans = ""
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            buf = b""
            while True:
                c = res.read(8192)
                if not c:
                    break
                buf += c
                while b"\n\n" in buf:
                    block, buf = buf.split(b"\n\n", 1)
                    for ln in block.decode("utf-8", "replace").split("\n"):
                        if not ln.startswith("data:"):
                            continue
                        try:
                            p = json.loads(ln[5:].strip())
                        except json.JSONDecodeError:
                            continue
                        events.append(p.get("type"))
                        if p.get("type") == "error":
                            print(iid, "ERR", json.dumps(p, ensure_ascii=False)[:500])
                        if p.get("type") == "done":
                            ans = str(p.get("answer") or ans)
                            print(
                                iid,
                                "done len",
                                len(ans),
                                "keys",
                                list(p.keys()),
                            )
                        if p.get("type") == "delta":
                            ans += str(p.get("text") or "")
    except Exception as e:
        print(iid, "EXC", e)
    print(iid, "events", events)
    print(iid, "head", repr(ans[:300]))
    print()
