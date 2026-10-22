#!/usr/bin/env python3
"""Build official acceptance artifacts after 100+30 regression."""
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
rep = Path(__file__).resolve().parent
summary_path = root / "rag_test_results/evaluation_summary.json"
ind_path = root / "rag_test_results/independent_summary.json"
ev = root / "rag_test_results/evaluation.csv"
gt56 = json.loads((root / "rag_test_results/ground_truth_56.json").read_text(encoding="utf-8"))

before = {
    "overall": 57.57,
    "PASS": 33,
    "FAIL": 7,
    "BLOCKED": 1,
    "UNVERIFIED": 59,
    "grade": "CẦN CẢI THIỆN",
}
after = {"overall": None}
if summary_path.exists():
    s = json.loads(summary_path.read_text(encoding="utf-8"))
    after = {
        "overall": s.get("total"),
        "PASS": (s.get("counts") or {}).get("PASS"),
        "FAIL": (s.get("counts") or {}).get("FAIL"),
        "BLOCKED": (s.get("counts") or {}).get("BLOCKED"),
        "UNVERIFIED": (s.get("counts") or {}).get("UNVERIFIED"),
        "grade": s.get("grade"),
        "dim_scores": s.get("dim_scores"),
        "gt_cases": s.get("gt_cases"),
    }

ind = {}
if ind_path.exists():
    ind = json.loads(ind_path.read_text(encoding="utf-8"))

mandatory = {}
t02 = {}
fails = []
if ev.exists():
    for row in csv.DictReader(ev.open(encoding="utf-8")):
        if str(row["id"]).startswith("TEST"):
            mandatory[row["id"]] = {
                "status": row["status"],
                "reason": row.get("reason"),
                "metrics": row.get("metrics"),
            }
        if row["id"] == "TEST02":
            try:
                t02 = json.loads(row.get("metrics") or "{}")
            except json.JSONDecodeError:
                t02 = {}
            t02["status"] = row["status"]
        if row["status"] in ("FAIL", "BLOCKED"):
            fails.append({"id": row["id"], "group": row["group"], "status": row["status"], "reason": row.get("reason")})

# Verify TEST02 order against live response if present
order_ok = None
resp_path = root / "rag_test_results/rag_responses.jsonl"
if resp_path.exists():
    import re

    for line in resp_path.read_text(encoding="utf-8").splitlines():
        o = json.loads(line)
        if o.get("id") != "TEST02":
            continue
        names = re.findall(r"^\s*\d+\.\s*([\u3400-\u9fff\uf900-\ufaff]+)", o.get("answer") or "", re.M)
        seen = set()
        uniq = []
        for n in names:
            if n in gt56["all_names"] and n not in seen:
                seen.add(n)
                uniq.append(n)
        order_ok = uniq == gt56["all_names"]
        t02["ordered_unique"] = len(uniq)
        t02["exact_order_match"] = order_ok
        t02["duplicates_in_list"] = len(names) - len(set(names))
        # citation evidence from answer body
        t02["answer_has_0256c07"] = "0256c07" in (o.get("answer") or "")
        t02["answer_has_title"] = "景德傳燈錄" in (o.get("answer") or "")
        break

gate = after.get("overall")
met = isinstance(gate, (int, float)) and gate >= 95
bam = {
    "before": before,
    "after": after,
    "independent_30": ind,
    "TEST02": t02,
    "mandatory": mandatory,
    "failed_or_blocked": fails,
    "target": 95,
    "gate_met": met,
    "completed_at": datetime.now(timezone.utc).isoformat(),
    "demo": "https://demo.tosuthien.net",
}
(rep / "before_after_metrics.json").write_text(
    json.dumps(bam, ensure_ascii=False, indent=2), encoding="utf-8"
)
# Official evaluation_summary at both places
official = {
    **(json.loads(summary_path.read_text(encoding="utf-8")) if summary_path.exists() else {}),
    "before_overall": 57.57,
    "after_overall": gate,
    "gate_target": 95,
    "gate_met": met,
    "independent_30": ind,
    "TEST02_verification": t02,
    "mandatory": mandatory,
    "completed_at": bam["completed_at"],
}
(root / "rag_test_results/evaluation_summary.json").write_text(
    json.dumps(official, ensure_ascii=False, indent=2), encoding="utf-8"
)
(rep / "evaluation_summary.json").write_text(
    json.dumps(official, ensure_ascii=False, indent=2), encoding="utf-8"
)

lines = [
    "# Final report — CBETA RAG acceptance",
    "",
    f"- Demo: https://demo.tosuthien.net",
    f"- Completed (UTC): {bam['completed_at']}",
    "- Before optimize: **57.57/100**",
    f"- After optimize (100 GT suite): **{gate}/100** ({after.get('grade')})",
    f"- Quality gate ≥95: **{'ĐẠT' if met else 'CHƯA ĐẠT'}**",
    "",
    "## Counts (100 suite)",
    (
        f"- PASS={after.get('PASS')} FAIL={after.get('FAIL')} "
        f"BLOCKED={after.get('BLOCKED')} UNVERIFIED={after.get('UNVERIFIED')}"
    ),
    f"- Ground-truth cases in suite: {after.get('gt_cases')}",
    "",
    "## Dimension scores",
    f"```json\n{json.dumps(after.get('dim_scores'), ensure_ascii=False, indent=2)}\n```",
    "",
    "## Mandatory tests",
    f"```json\n{json.dumps(mandatory, ensure_ascii=False, indent=2)}\n```",
    "",
    "## TEST02 — 56 pháp tự verification",
    f"```json\n{json.dumps(t02, ensure_ascii=False, indent=2)}\n```",
    f"- Exact order match vs GT chunk 0256c07: **{order_ok}**",
    "",
    "## Independent 30",
    f"```json\n{json.dumps(ind, ensure_ascii=False, indent=2)}\n```",
    "",
    "## FAIL / BLOCKED remaining",
    f"```json\n{json.dumps(fails, ensure_ascii=False, indent=2)}\n```",
    "",
    "## Deploy status",
    "- API rebuild deployed on VPS for demo.tosuthien.net (claude-opus-5-5).",
    "- Section-list path + work catalog + tightened section intent + hallucination grader fix.",
    "",
    "## Honest conclusion",
]
if met:
    lines.append("- Benchmark đạt ≥95 trên các chiều có grader PASS/FAIL.")
else:
    lines.append(
        f"- **Chưa đạt 95** (actual={gate}). Không nâng điểm bằng sửa GT/hardcode. "
        "Xem FAIL còn lại và UNVERIFIED coverage."
    )
lines += [
    "",
    "## Evidence paths",
    "- `rag_test_results/quality_report.md`",
    "- `rag_test_results/failed_cases.md`",
    "- `rag_test_results/rag_responses.jsonl`",
    "- `rag_improvement_report/regression_results.csv`",
    "- `rag_improvement_report/test04_manual_evidence.md` (if present)",
]
(rep / "final_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
(root / "rag_test_results/final_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("acceptance finalized", gate, "gate_met=", met)
