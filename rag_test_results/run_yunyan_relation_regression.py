#!/usr/bin/env python3
"""Regression: Yunyan 法嗣 / locator / gloss / coverage separation (Cases 1–9)."""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from collections import Counter

API = os.environ.get("CBETA_API_BASE", "http://127.0.0.1:8000/api").rstrip("/")

CASES = [
    {
        "id": "C1_relation",
        "q": "According to 景德傳燈錄 (T51n2076), how many Dharma successors (法嗣) did 雲巖曇晟 have? List their names and cite the original CBETA passage.",
        "expect_names": ["洞山良价", "杏山鑒洪", "神山僧密", "幽谿"],
        "forbid": ["Tây Thiên", "西天：", "Đông Độ"],
        "max_cites": 12,
        "work": "T51n2076",
        "not_coverage": True,
    },
    {
        "id": "C2_locator",
        "q": "From T51n2076 volume 15, locator T51n2076_p0317a22: 潭州雲巖曇晟禪師法嗣四人. List only the four Dharma successors named under that heading and cite T51n2076_p0317a22.",
        "expect_names": ["洞山良价", "杏山鑒洪", "神山僧密", "幽谿"],
        "forbid": ["Tây Thiên", "西天："],
        "max_cites": 12,
        "work": "T51n2076",
        "need_locator": "0317a22",
        "not_coverage": True,
    },
    {
        "id": "C3_translate",
        "q": "Cụm Hán văn '潭州雲巖曇晟禪師法嗣四人' có nghĩa gì? Chữ '四人' chỉ số lượng bao nhiêu? Chỉ trả lời trong tối đa 2 câu.",
        "expect_any": ["4", "bốn", "四人"],
        "forbid": ["Tây Thiên", "洞山良价"],
        "max_cites": 15,
        "prefer_work": "T51n2076",
        "max_sentences": 4,
    },
    {
        "id": "C4_enumeration",
        "q": "List all person-name occurrences in T51n2076 / liệt kê các vị tổ trong 景德傳燈錄",
        "expect_coverage": True,
        "forbid": [],
    },
    {
        "id": "C5_no_answer",
        "q": "Trong T51n2076, pháp tự của Thiền sư FakeMaster999XYZ là những ai?",
        "forbid_fabricate": ["FakeMaster999XYZ法嗣"],
        "not_coverage": True,
    },
    {
        "id": "C7_alias",
        "q": "Pháp tự của Vân Nham Đàm Thịnh (雲巖曇晟) theo T51n2076 gồm những ai?",
        "expect_names": ["洞山良价", "杏山鑒洪", "神山僧密", "幽谿"],
        "work": "T51n2076",
        "not_coverage": True,
    },
    {
        "id": "C9_cache_independence",
        "q": "Theo T51n2076, liệt kê pháp tự của 雲巖曇晟 và trích nguyên văn CBETA.",
        "expect_names": ["洞山良价", "杏山鑒洪", "神山僧密", "幽谿"],
        "forbid": ["Tây Thiên", "西天：", "Đông Độ"],
        "not_coverage": True,
        "after": "C4_enumeration",
    },
]


def chat(q: str) -> dict:
    body = json.dumps({"question": q}, ensure_ascii=False).encode()
    req = urllib.request.Request(
        f"{API}/cbeta/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read().decode())


def route(q: str) -> dict:
    body = json.dumps({"question": q}, ensure_ascii=False).encode()
    req = urllib.request.Request(
        f"{API}/cbeta/route",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def main() -> int:
    # C9: run enumeration first then relation
    enum_q = next(c for c in CASES if c["id"] == "C4_enumeration")["q"]
    print("warmup coverage…", flush=True)
    try:
        chat(enum_q)
    except Exception as e:
        print("WARN coverage warmup:", e)

    results = []
    for case in CASES:
        q = case["q"]
        print(f"\n=== {case['id']} ===", flush=True)
        try:
            rt = route(q)
            data = chat(q)
        except Exception as e:
            results.append({"id": case["id"], "pass": False, "error": str(e)})
            print("ERR", e)
            continue
        ans = data.get("answer") or ""
        cites = data.get("citations") or []
        meta = data.get("meta") or {}
        works = Counter((c.get("workCode") or "?") for c in cites)
        coverage = bool(rt.get("coverageMode") or meta.get("coverageAnswer") == "deterministic")
        person = bool(rt.get("personRelationMode"))
        fails = []

        if case.get("not_coverage") and coverage:
            fails.append("coverage_mode_on")
        if case.get("expect_coverage") and not coverage and not person:
            # soft: route may be coverage
            if not rt.get("coverageMode"):
                fails.append("expected_coverage_route")
        for n in case.get("expect_names") or []:
            if n not in ans:
                fails.append(f"missing:{n}")
        for n in case.get("expect_any") or []:
            if not any(x in ans for x in case["expect_any"]):
                fails.append("expect_any_miss")
                break
        for f in case.get("forbid") or []:
            if f in ans:
                fails.append(f"forbid:{f}")
        if case.get("work"):
            if cites and works.most_common(1)[0][0] != case["work"]:
                fails.append(f"cite_work:{works.most_common(3)}")
        if case.get("prefer_work") and cites:
            top = works.most_common(1)[0][0]
            if top != case["prefer_work"] and case["prefer_work"] not in works:
                fails.append(f"prefer_work_missing:{works.most_common(5)}")
        if case.get("max_cites") is not None and len(cites) > case["max_cites"]:
            fails.append(f"too_many_cites:{len(cites)}")
        if case.get("need_locator") and case["need_locator"] not in ans and case["need_locator"] not in json.dumps(rt, ensure_ascii=False):
            # locator may appear in meta route
            if case["need_locator"] not in (rt.get("cbetaRefNeedle") or ""):
                fails.append("locator_not_parsed")
        if case.get("max_sentences"):
            # rough sentence count
            sc = len([s for s in ans.replace("!", ".").replace("?", ".").split(".") if s.strip()])
            if sc > case["max_sentences"] + 2:  # allow PHẦN markers
                fails.append(f"too_long:{sc}")

        ok = not fails
        row = {
            "id": case["id"],
            "pass": ok,
            "fails": fails,
            "citations": len(cites),
            "coverageMode": rt.get("coverageMode"),
            "personRelationMode": rt.get("personRelationMode"),
            "cbetaRefNeedle": rt.get("cbetaRefNeedle"),
            "works": works.most_common(5),
            "answer_head": ans[:280],
        }
        results.append(row)
        print(json.dumps(row, ensure_ascii=False, indent=2))

    passed = sum(1 for r in results if r.get("pass"))
    print(f"\nSUMMARY {passed}/{len(results)}", flush=True)
    out = os.environ.get("OUT", "")
    if out:
        with open(out, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
