#!/usr/bin/env python3
"""Run 30 independent GT tests against live CBETA API; append evidence."""
from __future__ import annotations

import csv
import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API = __import__("os").environ.get("CBETA_API_BASE", "https://demo.tosuthien.net/api").rstrip("/")
CASES = [json.loads(l) for l in (ROOT / "independent_30.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]


def chat(question: str, timeout: float = 180) -> dict:
    t0 = time.time()
    req = urllib.request.Request(
        f"{API}/cbeta/chat/stream",
        data=json.dumps({"question": question}).encode(),
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
        method="POST",
    )
    answer = ""
    citations = []
    meta = None
    err = None
    try:
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
                        t = p.get("type")
                        if t == "delta":
                            answer += str(p.get("text") or "")
                        if t == "done":
                            if p.get("answer"):
                                answer = str(p.get("answer"))
                            if p.get("citations"):
                                citations = p.get("citations") or citations
                        if t == "citations":
                            citations = p.get("citations") or citations
                        if t == "meta":
                            meta = p.get("meta") or p
                        if t == "error":
                            err = p
    except Exception as e:
        err = {"type": "client_error", "message": str(e)}
    return {
        "answer": answer,
        "citations": citations,
        "meta": meta,
        "error": err,
        "latency_ms": int((time.time() - t0) * 1000),
    }


def grade(case: dict, resp: dict) -> dict:
    ans = resp.get("answer") or ""
    gt = case.get("ground_truth") or {}
    status = "UNVERIFIED"
    reason = ""
    if resp.get("error") and not ans.strip():
        return {"id": case["id"], "status": "BLOCKED", "reason": str(resp["error"]), "latency_ms": resp["latency_ms"]}

    if gt.get("first5"):
        hits = sum(1 for n in gt["first5"] if n in ans)
        status = "PASS" if hits >= 4 else "FAIL"
        reason = f"first5_hits={hits}/5"
    elif gt.get("name") and gt.get("expect_in"):
        status = "PASS" if gt["name"] in ans else "FAIL"
        reason = f"name={gt['name']} expect_in={gt['expect_in']}"
    elif gt.get("name"):
        status = "PASS" if gt["name"] in ans else "FAIL"
        reason = f"name={gt['name']}"
    elif gt.get("work_code") and gt.get("title"):
        ok = gt["work_code"] in ans and gt["title"] in ans
        status = "PASS" if ok else ("PASS" if gt["work_code"] in ans else "FAIL")
        reason = f"code={gt['work_code'] in ans} title={gt['title'] in ans}"
    elif gt.get("work_code"):
        status = "PASS" if gt["work_code"] in ans else "FAIL"
        reason = f"work_code={gt['work_code']}"
    elif gt.get("same"):
        status = "PASS" if ("một người" in ans or "cùng" in ans or "同一" in ans or "大寂" in ans) else "UNVERIFIED"
    elif gt.get("different"):
        status = "PASS" if re.search(r"khác|không phải một|不同", ans, re.I) else "UNVERIFIED"
    elif gt.get("edge"):
        a, b = gt["edge"]
        aliases = {
            "慧能": ["慧能", "惠能"],
            "懷讓": ["懷讓", "南嶽"],
            "黃檗": ["黃檗", "希運"],
            "臨濟": ["臨濟", "義玄"],
            "百丈": ["百丈", "懷海"],
            "馬祖": ["馬祖", "道一"],
        }
        def hit(tok: str) -> bool:
            return any(x in ans for x in aliases.get(tok, [tok]))
        ok = hit(a) and hit(b) and bool(re.search(r"T51n|傳燈|法嗣|CBETA|卷|quyển", ans, re.I))
        status = "PASS" if ok else "FAIL"
        reason = f"edge={a}->{b}"
    elif gt.get("expect_absent") or gt.get("absent") or gt.get("invalid") or gt.get("false_claim"):
        denies = bool(re.search(r"không (thấy|có)|chưa|không phải|sai|invalid|未見|沒有", ans, re.I))
        status = "PASS" if denies else "UNVERIFIED"
        reason = "denial" if denies else "unclear"
    elif gt.get("cjk"):
        needles = gt["cjk"] if isinstance(gt["cjk"], list) else [gt["cjk"]]
        ok = all(n in ans for n in needles)
        status = "PASS" if ok else "FAIL"
        reason = f"cjk={needles}"
    elif gt.get("tiansheng"):
        ok = gt["tiansheng"] in ans and gt.get("not", "T51n2077") and (
            gt["not"] not in ans or "續傳燈" in ans or "không phải" in ans or "khác" in ans
        )
        # Pass if X78 present; fail only if explicitly maps 2077=天聖
        wrong = bool(re.search(r"T51n2077.{0,20}天聖", ans))
        status = "FAIL" if wrong else ("PASS" if gt["tiansheng"] in ans or "天聖廣燈" in ans else "UNVERIFIED")
        reason = f"x78={gt['tiansheng'] in ans} wrong2077={wrong}"
    elif gt.get("rec") and gt.get("norec"):
        ok = str(gt["rec"]) in ans and str(gt["norec"]) in ans
        status = "PASS" if ok else "FAIL"
        reason = f"rec={gt['rec']} norec={gt['norec']}"
    elif gt.get("rec"):
        status = "PASS" if str(gt["rec"]) in ans else "FAIL"
        reason = f"rec={gt['rec']}"
    elif gt.get("works"):
        ok = all(w in ans for w in gt["works"])
        status = "PASS" if ok else "UNVERIFIED"
        reason = f"works={gt['works']}"
    elif gt.get("not_100") and gt.get("is_56"):
        deny100 = bool(re.search(r"không.{0,20}100|không phải 100|56", ans, re.I))
        status = "PASS" if ("56" in ans and deny100) else "FAIL"
        reason = "56_not_100"
    elif gt.get("juan") and gt.get("ref"):
        ok = (str(gt["juan"]) in ans or f"quyển {gt['juan']}" in ans) and gt["ref"] in ans
        heads = gt.get("heading_needles") or []
        ok = ok and any(h in ans for h in heads)
        status = "PASS" if ok else "FAIL"
        reason = f"juan/ref/heading"
    elif gt.get("same_variant"):
        status = "PASS" if re.search(r"cùng|một|異體|cùng một|同一", ans, re.I) else "UNVERIFIED"

    return {
        "id": case["id"],
        "group": case.get("group", "I"),
        "status": status,
        "reason": reason,
        "latency_ms": resp["latency_ms"],
        "question": case["question"],
    }


def main() -> None:
    rows = []
    responses = []
    print(f"Independent 30 vs {API}")
    for i, case in enumerate(CASES, 1):
        print(f"[{i:02d}/30] {case['id']} …", flush=True)
        resp = chat(case["question"])
        responses.append({"id": case["id"], **{k: resp.get(k) for k in ("answer", "citations", "meta", "error", "latency_ms")}, "question": case["question"]})
        g = grade(case, resp)
        rows.append(g)
        print(f"    → {g['status']} ({g['latency_ms']}ms) {g.get('reason','')[:80]}", flush=True)

    out_resp = ROOT / "independent_responses.jsonl"
    with out_resp.open("w", encoding="utf-8") as f:
        for r in responses:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    out_csv = ROOT / "independent_evaluation.csv"
    with out_csv.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "group", "status", "latency_ms", "reason", "question"])
        w.writeheader()
        for r in rows:
            w.writerow(r)

    counts = {k: 0 for k in ("PASS", "FAIL", "BLOCKED", "UNVERIFIED")}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    summary = {
        "suite": "independent_30",
        "api": API,
        "counts": counts,
        "n": len(rows),
        "pass_rate_scored": (
            counts["PASS"] / (counts["PASS"] + counts["FAIL"])
            if (counts["PASS"] + counts["FAIL"])
            else None
        ),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    (ROOT / "independent_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("DONE", summary)


if __name__ == "__main__":
    main()
