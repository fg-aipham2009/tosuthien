#!/usr/bin/env python3
"""Locate authentic CBETA phrase hits for golden scripture cases (no LLM)."""
from __future__ import annotations

import json
import subprocess
import sys

CASES = [
    ("SE_PRAJ_HEART_01", "T08n0251", "色即是空"),
    ("SE_PRAJ_DIAMOND_01", "T08n0235", "應無所住而生其心"),
    ("SE_MADHYAMAKA_01", "T30n1564", "眾因緣生法"),
    ("SE_YOGACARA_01", "T31n1585", "阿賴耶識"),
    ("SE_PURELAND_01", "T12n0366", "執持名號"),
    ("SE_LOTUS_01", "T09n0262", "唯有一佛乘"),
    ("SE_AVATAMSAKA_01", "T10n0279", "心如工畫師"),
    ("SE_AGAMA_ANATTA_01", "T02n0099", "無我"),
    ("SE_VINAYA_01", "T22n1428", "非時食"),
    ("SE_ABHIDHARMA_01", "T29n1558", "無常"),
    ("SE_PENDING_01", "T01n0026", "云何為無常"),
    ("SE_PENDING_02", "T02n0099", "緣起"),
    ("SE_PENDING_05", "T09n0262", "開佛知見"),
    ("SE_PENDING_08", "T12n0360", "四十八願"),
    ("SE_PENDING_09", "T14n0475", "不二法門"),
]


def q(sql: str) -> str:
    return subprocess.check_output(
        [
            "docker",
            "compose",
            "-f",
            "/opt/tosu-thien/docker-compose.yml",
            "exec",
            "-T",
            "db",
            "psql",
            "-U",
            "tosuthien",
            "-d",
            "cbeta",
            "-t",
            "-A",
            "-F",
            "\t",
            "-c",
            sql,
        ],
        text=True,
    ).strip()


def main() -> int:
    out = []
    for cid, work, phrase in CASES:
        esc = phrase.replace("'", "''")
        sql = f"""
WITH hits AS (
  SELECT work_code, juan_no, cbeta_ref_start, chunk_index,
         position('{esc}' in content_zh) AS pos,
         content_zh
  FROM chunks
  WHERE work_code='{work}' AND content_zh LIKE '%{esc}%'
)
SELECT work_code, juan_no::text, cbeta_ref_start, chunk_index::text, pos::text,
       substr(content_zh, greatest(pos-20,1), least(char_length('{esc}')+40, 120))
FROM hits
ORDER BY
  CASE WHEN pos > 20 THEN 0 ELSE 1 END,
  CASE WHEN juan_no > 0 THEN 0 ELSE 1 END,
  chunk_index
LIMIT 1;
"""
        try:
            r = q(sql)
        except subprocess.CalledProcessError as e:
            print(cid, "ERROR", e, file=sys.stderr)
            continue
        print(cid, "=>", (r[:220] if r else "NOT_FOUND").replace("\n", " "))
        if not r:
            continue
        p = r.split("\t")
        out.append(
            {
                "id": cid,
                "work_id": p[0],
                "juan": p[1],
                "locator": p[2],
                "chunk_index": int(p[3]),
                "pos": int(p[4]),
                "original_passage": p[5] if len(p) > 5 else "",
                "phrase_needle": phrase,
                "corpus_hit": True,
                "review_status": "corpus_located",
            }
        )
    path = "/tmp/phrase_verified.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("OK", len(out), "->", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
