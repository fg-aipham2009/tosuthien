#!/usr/bin/env python3
"""Trial run: translate a CBETA passage sentence-by-sentence, then let a second model review it.

Usage:
  python3 scripts/canon/try_translate.py --xml data/cbeta/xml-p5/X/X70/X70n1401.xml \
      --start 高峰和尚禪要 --sentences 20 --translator claude-opus-5-5 --reviewer gpt-6-astra \
      --out ~/Desktop/dich-thu.md
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from cbeta_parser import parse_file

PROMPT_DIR = Path(__file__).resolve().parent / "prompts"


def prompt_cache_enabled() -> bool:
    # Default OFF: HHTech/Anthropic ephemeral cache ~5 min — little save on long batch gaps.
    # Opt in with CANON_PROMPT_CACHE=1. Fable never caches (see _is_fable_model / _chat).
    return os.environ.get("CANON_PROMPT_CACHE", "0").strip().lower() in ("1", "true", "yes", "on")


def _is_claude_model(model: str) -> bool:
    m = model.lower()
    return "claude" in m or "opus" in m or "fable" in m or "sonnet" in m or "haiku" in m


def _is_fable_model(model: str) -> bool:
    """Fable confirmer: never use prompt cache (gateway max / no real cost win)."""
    return "fable" in model.lower()


def _system_message(model: str, system: str, *, use_cache: bool) -> dict:
    """Stable system prompt first; Claude needs an explicit cache_control breakpoint for HHTech/Anthropic."""
    if use_cache and _is_claude_model(model) and not _is_fable_model(model):
        return {
            "role": "system",
            "content": [{
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }],
        }
    return {"role": "system", "content": system}


def normalize_usage(usage: dict) -> dict:
    """Attach _cache_read / _cache_write from OpenAI- or Anthropic-shaped usage blocks."""
    out = dict(usage or {})
    details = out.get("prompt_tokens_details") or out.get("input_tokens_details") or {}
    if not isinstance(details, dict):
        details = {}
    cache_read = (
        details.get("cached_tokens")
        or out.get("cache_read_input_tokens")
        or out.get("cache_read_tokens")
        or 0
    )
    cache_write = (
        details.get("cache_write_tokens")
        or out.get("cache_creation_input_tokens")
        or out.get("cache_write_tokens")
        or 0
    )
    if isinstance(out.get("cache_creation"), dict):
        cache_write = cache_write or sum(
            int(v or 0) for v in out["cache_creation"].values() if isinstance(v, (int, float))
        )
    out["_cache_read"] = int(cache_read or 0)
    out["_cache_write"] = int(cache_write or 0)
    return out


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


class KeyPool:
    """Round-robin across live keys so parallel workers burn credits together.

    A key that returns auth/credit exhaustion is retired and skipped until the keys file changes
    (or is re-read after the pool runs dry), which clears retirements and retries from the top.
    HHTECH_API_KEYS_FILE / HHTECH_CONFIRM_KEYS_FILE: one key per line, kept outside the repo.
    """
    EXHAUSTED = {401, 402, 403}

    def __init__(self, keys_env: str, file_env: str) -> None:
        self.lock = threading.Lock()
        self.file_env = file_env
        self.env_keys = [k.strip() for k in os.environ.get(keys_env, "").split(",") if k.strip()]
        self.keys: list[str] = list(self.env_keys)
        self.retired: set[str] = set()
        self.file_mtime: float | None = None
        self._rr = 0
        self._reload()

    def _live(self) -> list[tuple[int, str]]:
        return [(i, k) for i, k in enumerate(self.keys) if k not in self.retired]

    def _reload(self) -> None:
        """Sync keys to env + file. A newer file mtime clears retirements so topped-up keys retry."""
        path = os.environ.get(self.file_env)
        file_keys: list[str] = []
        mtime = self.file_mtime
        if path and os.path.exists(path):
            mtime = os.path.getmtime(path)
            with open(path, encoding="utf-8") as fh:
                file_keys = [ln.strip() for ln in fh if ln.strip() and not ln.strip().startswith("#")]
        new_keys = list(dict.fromkeys([*self.env_keys, *file_keys]))
        file_changed = self.file_mtime is not None and mtime != self.file_mtime
        self.file_mtime = mtime
        self.keys = new_keys
        if file_changed:
            self.retired.clear()
            self._rr = 0
        else:
            self.retired = {k for k in self.retired if k in self.keys}

    def available(self) -> bool:
        with self.lock:
            if not self._live():
                self._reload()
            return bool(self._live())

    def current(self) -> tuple[int, str] | None:
        """Next live key in round-robin order (parallel workers share the pool evenly)."""
        with self.lock:
            live = self._live()
            if not live:
                self._reload()
                live = self._live()
            if not live:
                return None
            slot = live[self._rr % len(live)]
            self._rr += 1
            return slot

    def retire(self, index: int, reason: str) -> None:
        with self.lock:
            if not (0 <= index < len(self.keys)):
                return
            key = self.keys[index]
            if key in self.retired:
                return
            self.retired.add(key)
            left = len(self._live())
            print(f"  key #{index + 1} retired ({reason}); "
                  f"{left} live key(s) left" if left else "no keys left",
                  file=sys.stderr, flush=True)


POOL_ENV = {"main": ("HHTECH_API_KEYS", "HHTECH_API_KEYS_FILE"),
            "confirm": ("HHTECH_CONFIRM_KEYS", "HHTECH_CONFIRM_KEYS_FILE")}
POOLS: dict[str, KeyPool] = {}
POOLS_LOCK = threading.Lock()


def key_pool(name: str) -> KeyPool:
    with POOLS_LOCK:
        if name not in POOLS:
            POOLS[name] = KeyPool(*POOL_ENV[name])
        return POOLS[name]


def chat(model: str, system: str, user: str, key_env: str = "HHTECH_API_KEY",
         pool: str = "main", fallback: bool = True) -> tuple[str, dict, float]:
    """pool="confirm" uses the confirm keys; with none configured or all exhausted it falls back to the main
    pool unless fallback=False (models the main keys may not be allowed to call, whose 403 would retire them)."""
    keys = key_pool(pool)
    if pool != "main" and fallback and not keys.available():
        keys, pool = key_pool("main"), "main"
    if not keys.keys:
        return _chat(model, system, user, os.environ.get(key_env) or os.environ["HHTECH_API_KEY"])
    while True:
        if not keys.available():
            if pool != "main" and fallback:
                keys, pool = key_pool("main"), "main"
                continue
            raise RuntimeError("all HHTech keys exhausted" if pool == "main" else f"{pool} keys exhausted")
        slot = keys.current()
        if slot is None:
            if pool != "main" and fallback:
                keys, pool = key_pool("main"), "main"
                continue
            raise RuntimeError("all HHTech keys exhausted" if pool == "main" else f"{pool} keys exhausted")
        index, key = slot
        try:
            return _chat(model, system, user, key)
        except urllib.error.HTTPError as err:
            if err.code not in KeyPool.EXHAUSTED:
                raise
            keys.retire(index, f"{pool} pool HTTP {err.code}: {err.read().decode(errors='ignore')}")


def _chat_request(model: str, system: str, user: str, api_key: str, *, use_cache: bool) -> tuple[str, dict, float]:
    # Hard ban: never send cache markers for Fable (gateway max / no cost win).
    if _is_fable_model(model):
        use_cache = False
    base = os.environ.get("HHTECH_BASE_URL", "https://hhtechapi.com/v1").rstrip("/")
    payload: dict = {
        "model": model,
        "temperature": float(os.environ.get("CANON_TEMPERATURE", "0.2")),
        "messages": [_system_message(model, system, use_cache=use_cache), {"role": "user", "content": user}],
    }
    if use_cache:
        # Same key across workers sharing translate/review/adjudicate system prompts → better cache hit rate.
        payload["prompt_cache_key"] = (
            os.environ.get("CANON_PROMPT_CACHE_KEY")
            or f"canon:{model}:{hashlib.sha256(system.encode()).hexdigest()[:16]}"
        )
    body = json.dumps(payload).encode()
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    if use_cache and _is_claude_model(model) and not _is_fable_model(model):
        # Ask Anthropic-compatible upstreams to honour cache_control on chat/completions.
        headers["anthropic-beta"] = "prompt-caching-2024-07-31"
    req = urllib.request.Request(f"{base}/chat/completions", data=body, headers=headers)
    start = time.time()
    with urllib.request.urlopen(req, timeout=float(os.environ.get("CANON_TIMEOUT", "600"))) as res:
        data = json.load(res)
    usage = normalize_usage(data.get("usage") or {})
    # Don't attribute provider-side cache counters to Fable in our ledgers/logs.
    if _is_fable_model(model):
        usage["_cache_read"] = 0
        usage["_cache_write"] = 0
    return (
        data["choices"][0]["message"]["content"].strip(),
        usage,
        time.time() - start,
    )


def _chat(model: str, system: str, user: str, api_key: str) -> tuple[str, dict, float]:
    # Fable: never use prompt cache.
    use_cache = prompt_cache_enabled() and not _is_fable_model(model)
    try:
        return _chat_request(model, system, user, api_key, use_cache=use_cache)
    except urllib.error.HTTPError as err:
        # If the gateway rejects cache markers / prompt_cache_key, fall back once without them.
        if use_cache and err.code in (400, 422):
            err.read()  # drain body so the connection can close cleanly
            print("  prompt-cache payload rejected; retrying without cache markers",
                  file=sys.stderr, flush=True)
            return _chat_request(model, system, user, api_key, use_cache=False)
        raise


def parse_json(text: str):
    match = re.search(r"\{.*\}|\[.*\]", text, re.S)
    return json.loads(match.group(0) if match else text)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--xml", required=True)
    ap.add_argument("--start", help="Begin at the first sentence containing this text")
    ap.add_argument("--sentences", type=int, required=True)
    ap.add_argument("--translator", required=True)
    ap.add_argument("--reviewer", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[2]
    load_env(root / ".env")

    xml_path = root / args.xml
    segments = parse_file(xml_path, xml_path.parent.parent.name)
    if args.start:
        idx = next(i for i, s in enumerate(segments) if args.start in s.content_zh)
        segments = segments[idx:]
    segments = segments[: args.sentences]
    numbered = {str(i + 1): s.content_zh for i, s in enumerate(segments)}
    meta = {str(i + 1): s for i, s in enumerate(segments)}

    translate_system = (PROMPT_DIR / "translate.md").read_text(encoding="utf-8")
    review_system = (PROMPT_DIR / "review.md").read_text(encoding="utf-8")
    source_json = json.dumps(numbered, ensure_ascii=False, indent=1)

    raw, t_usage, t_sec = chat(args.translator, translate_system, source_json)
    translated = parse_json(raw)
    missing = [k for k in numbered if not str(translated.get(k, "")).strip()]

    review_input = json.dumps(
        [{"n": k, "zh": numbered[k], "vi": translated.get(k, "")} for k in numbered],
        ensure_ascii=False, indent=1,
    )
    raw_review, r_usage, r_sec = chat(args.reviewer, review_system, review_input, "HHTECH_REVIEW_API_KEY")
    issues = parse_json(raw_review)
    if isinstance(issues, dict):
        issues = issues.get("issues", [])

    lines = [
        f"# Dịch thử: {args.xml}\n",
        f"- Dịch: `{args.translator}` ({t_sec:.0f}s, in {t_usage.get('prompt_tokens')} / out {t_usage.get('completion_tokens')} tokens)",
        f"- Soát: `{args.reviewer}` ({r_sec:.0f}s, in {r_usage.get('prompt_tokens')} / out {r_usage.get('completion_tokens')} tokens)",
        f"- Số câu: {len(numbered)} | thiếu câu: {missing or 'không'} | AI soát báo lỗi: {len(issues)}\n",
        "## Bản dịch\n",
    ]
    paragraph: list[str] = []
    for i, k in enumerate(numbered):
        paragraph.append(str(translated.get(k, "")))
        nxt = list(numbered)[i + 1] if i + 1 < len(numbered) else None
        if nxt is None or meta[nxt].paragraph_no != meta[k].paragraph_no or meta[nxt].juan_no != meta[k].juan_no:
            lines.append(" ".join(paragraph) + "\n")
            paragraph = []
    lines.append("## Song ngữ từng câu\n")
    for k, zh in numbered.items():
        s = meta[k]
        lines.append(f"{k}. [{s.segment_type} · {s.cbeta_ref}] {zh}\n   → {translated.get(k, '')}\n")
    lines.append("## Kết quả AI soát\n")
    lines.append("```json\n" + json.dumps(issues, ensure_ascii=False, indent=1) + "\n```\n")

    out = Path(args.out).expanduser()
    out.write_text("\n".join(lines), encoding="utf-8")
    print(out)


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as err:
        sys.exit(f"HTTP {err.code}: {err.read().decode(errors='ignore')}")
