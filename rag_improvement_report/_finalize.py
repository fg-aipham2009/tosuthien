#!/usr/bin/env python3
"""Write before_after_metrics.json + final_report.md from eval artifacts."""
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
rep = Path(__file__).resolve().parent
summary_path = root / "rag_test_results/evaluation_summary.json"
before = {
    "overall": 57.57,
    "PASS": 33,
    "FAIL": 7,
    "BLOCKED": 1,
    "UNVERIFIED": 59,
    "grade": "CẦN CẢI THIỆN",
}
after: dict = {"overall": None}
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
    }
t02: dict = {}
ev = root / "rag_test_results/evaluation.csv"
if ev.exists():
    for row in csv.DictReader(ev.open(encoding="utf-8")):
        if row["id"] == "TEST02":
            try:
                t02 = json.loads(row.get("metrics") or "{}")
            except json.JSONDecodeError:
                t02 = {}
            t02["status"] = row["status"]
            t02["reason"] = row.get("reason")
mandatory = {}
if ev.exists():
    for row in csv.DictReader(ev.open(encoding="utf-8")):
        if str(row["id"]).startswith("TEST"):
            mandatory[row["id"]] = row["status"]

bam = {
    "before": before,
    "after": after,
    "TEST02_after": t02,
    "mandatory_after": mandatory,
    "target": 95,
    "completed_at": datetime.now(timezone.utc).isoformat(),
}
(rep / "before_after_metrics.json").write_text(
    json.dumps(bam, ensure_ascii=False, indent=2), encoding="utf-8"
)
gate = after.get("overall")
met = isinstance(gate, (int, float)) and gate >= 95
lines = [
    "# Final report — CBETA RAG improvement",
    "",
    f"- Completed (UTC): {bam['completed_at']}",
    "- Before: **57.57/100** (CẦN CẢI THIỆN)",
    f"- After: **{gate}/100** ({after.get('grade')})",
    f"- Quality gate ≥95: **{'ĐẠT' if met else 'CHƯA ĐẠT'}**",
    "",
    "## Counts after",
    (
        f"- PASS={after.get('PASS')} FAIL={after.get('FAIL')} "
        f"BLOCKED={after.get('BLOCKED')} UNVERIFIED={after.get('UNVERIFIED')}"
    ),
    "",
    "## Dimensions after",
    f"```json\n{json.dumps(after.get('dim_scores'), ensure_ascii=False, indent=2)}\n```",
    "",
    "## Mandatory tests",
    f"```json\n{json.dumps(mandatory, ensure_ascii=False, indent=2)}\n```",
    "",
    "## TEST02 extraction",
    f"```json\n{json.dumps(t02, ensure_ascii=False, indent=2)}\n```",
    "",
    "## Evidence",
    "- `rag_test_results/quality_report.md`",
    "- `rag_test_results/failed_cases.md`",
    "- `rag_improvement_report/regression_results.csv`",
    "- `rag_improvement_report/root_cause_analysis.md`",
    "- `rag_improvement_report/changes.md`",
    "- `rag_improvement_report/deployment_log.md`",
    "",
    "## Honest note",
    "- Không hardcode đáp án benchmark vào production.",
    "- Nếu overall < 95: không tuyên bố đạt gate; ưu tiên evidence trong failed_cases.",
]
(rep / "final_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("finalized", gate, after.get("grade"), "gate_met=", met)
