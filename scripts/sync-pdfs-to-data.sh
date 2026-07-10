#!/usr/bin/env bash
# Copy numbered PDFs from kinhsach/ → data/pdf/ for docker/VPS (/data/pdf).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 16 17 18 19 20 21; do
  src="$ROOT/kinhsach/$i.pdf"
  dst="$ROOT/data/pdf/$i.pdf"
  if [[ ! -f "$src" ]]; then
    echo "skip: missing $src" >&2
    continue
  fi
  cp -f "$src" "$dst"
  echo "ok: $i.pdf"
done
