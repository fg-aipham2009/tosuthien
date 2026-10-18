#!/usr/bin/env python3
"""Translate one CBETA XML file end-to-end: translate → AI review → one retry for flagged sentences.

Progress is checkpointed after every batch ({stem}.partial.json) so an interrupted run resumes without
paying again. Writes {stem}.json (per-sentence result for DB import) and {stem}.md (readable).

Usage:
  HHTECH_API_KEY=... python3 scripts/canon/translate_work.py \
      --xml data/cbeta/xml-p5/X/X01/X01n0005.xml \
      --translator claude-opus-5-5 --reviewer gpt-6-astra --batch-chars 1200 \
      --out-dir data/cbeta/translations/X
"""
from __future__ import annotations

import argparse
import fcntl
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from itertools import groupby
import re
import socket
import sys
import time
import urllib.error
from dataclasses import asdict, dataclass
from pathlib import Path

from bilingual_format import write_bilingual_markdown
from cbeta_parser import Segment, parse_file, work_title
from try_translate import PROMPT_DIR, chat, load_env, parse_json

CJK = re.compile(r"[\u3400-\u9fff\U00020000-\U0003134f]")
PRICING = json.loads((Path(__file__).resolve().parent / "pricing.json").read_text(encoding="utf-8"))
FATAL_HTTP = {400, 401, 402, 403, 404}
# The translator's own doubt marker (prompts/translate.md: Hán gốc + " [?]").
UNSURE_MARK = "[?]"
LACUNA_MARK = "[khuyết]"
ILLEGIBLE_CHAR = "□"
# Original-edition notes saying text is lost or unreadable; a model cannot recover such text.
LACUNA_NOTE = re.compile(r"佚|闕|缺|磨滅|不明|漫漶")
SELF_DOUBT_ISSUE = {"type": "khong_chac", "detail": "người dịch tự ghi [?] — chưa chắc nghĩa"}
HUMAN_JUDGE = "human"


@dataclass
class Options:
    translator: str
    reviewer: str
    batch_chars: int
    max_attempts: int
    retry_wait: int
    deadline: float | None = None
    confirmer: str | None = None
    batch_workers: int = 1
    arbiter: str | None = None
    polish_model: str | None = None

    def judges(self) -> list[str]:
        """Adjudication order for flagged rows: arbiter, then confirmer.

        The translator already drafted the sentence; re-judging with it doubles Opus cost for little gain.
        If no arbiter is set, fall back to translator then confirmer.
        """
        head = self.arbiter or self.translator
        return [m for m in (head, self.confirmer) if m]


class StopRequested(Exception):
    """Raised before starting a batch once the run's stop time has passed (progress is already saved)."""


class Usage:
    def __init__(self, by_model: dict | None = None) -> None:
        self.by_model: dict[str, dict[str, float]] = by_model or {}

    def add(self, model: str, usage: dict, seconds: float) -> None:
        row = self.by_model.setdefault(
            model, {"calls": 0, "in": 0, "out": 0, "cache_read": 0, "cache_write": 0, "seconds": 0.0},
        )
        row["calls"] += 1
        row["in"] += usage.get("prompt_tokens") or 0
        row["out"] += usage.get("completion_tokens") or 0
        row["cache_read"] = (row.get("cache_read") or 0) + (usage.get("_cache_read") or 0)
        row["cache_write"] = (row.get("cache_write") or 0) + (usage.get("_cache_write") or 0)
        row["seconds"] += seconds

    def credits(self, model: str) -> float | None:
        """Estimate credits. Cache-read tokens still count in `in`; HHTech bills them cheaper server-side,
        so this local estimate stays slightly high until pricing.json has cache rates."""
        price = PRICING.get(model)
        if not price:
            return None
        row = self.by_model[model]
        return (row["in"] * price["input"] + row["out"] * price["output"]) / 1_000_000

    def total_credits(self) -> float:
        return sum(self.credits(m) or 0 for m in self.by_model)


def with_retry(opts: Options, fn, *args):
    for attempt in range(1, opts.max_attempts + 1):
        try:
            return fn(*args)
        except urllib.error.HTTPError as err:
            if err.code in FATAL_HTTP:
                raise
            reason = f"HTTP {err.code}"
        except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError,
                json.JSONDecodeError, KeyError, AttributeError) as err:
            reason = repr(err)
        if attempt == opts.max_attempts:
            raise RuntimeError(f"gave up after {attempt} attempts: {reason}")
        wait = opts.retry_wait * attempt
        print(f"  retry {attempt}/{opts.max_attempts} in {wait}s ({reason})", file=sys.stderr, flush=True)
        time.sleep(wait)


def batches(segments: list[Segment], max_chars: int) -> list[list[Segment]]:
    """Group whole paragraphs up to max_chars; a paragraph longer than max_chars is split between sentences."""
    out: list[list[Segment]] = []
    current: list[Segment] = []
    size = 0
    i = 0
    while i < len(segments):
        j = i
        while j < len(segments) and (segments[j].juan_no, segments[j].paragraph_no) == (
            segments[i].juan_no, segments[i].paragraph_no
        ):
            j += 1
        paragraph = segments[i:j]
        p_size = sum(len(s.content_zh) for s in paragraph)
        if current and size + p_size > max_chars:
            out.append(current)
            current, size = [], 0
        if p_size > max_chars:
            for seg in paragraph:
                if current and size + len(seg.content_zh) > max_chars:
                    out.append(current)
                    current, size = [], 0
                current.append(seg)
                size += len(seg.content_zh)
        else:
            current.extend(paragraph)
            size += p_size
        i = j
    if current:
        out.append(current)
    return out


@contextmanager
def work_lock(finished_json: Path):
    """Exclusive lock for a read-modify-write of a finished {stem}.json, shared by every script that edits it."""
    lock_dir = finished_json.parent / "_locks"
    lock_dir.mkdir(exist_ok=True)
    with open(lock_dir / f"{finished_json.stem}.lock", "w") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(fh, fcntl.LOCK_UN)


RENUMBERED_FIELDS = ("juan_label", "seq", "paragraph_no", "segment_type", "cbeta_ref", "heading_level")


class UnmatchedRows(RuntimeError):
    """Earlier translated rows that no longer exist in the parsed source; continuing would drop them."""


def align(segments: list[Segment], rows: list[dict]) -> list[dict | None]:
    """Match earlier translated rows to the current segments by (juan, Chinese text), in reading order.

    Matched rows take the current numbering and line refs (the parser may now emit text it used to skip,
    which shifts seq / paragraph numbers); segments without a row stay None and still need translating.
    """
    positions: dict[tuple, list[int]] = {}
    for i, seg in enumerate(segments):
        positions.setdefault((seg.juan_no, seg.content_zh), []).append(i)
    out: list[dict | None] = [None] * len(segments)
    last = -1
    unmatched = []
    for row in rows:
        candidates = [i for i in positions.get((row["juan_no"], row["content_zh"]), []) if i > last]
        if not candidates:
            unmatched.append(row)
            continue
        last = candidates[0]
        seg = segments[last]
        for f in RENUMBERED_FIELDS:
            row[f] = getattr(seg, f)
        out[last] = row
    if unmatched:
        raise UnmatchedRows(f"{len(unmatched)} translated row(s) not found in the source, first: "
                            f"{unmatched[0].get('cbeta_ref')} {unmatched[0]['content_zh'][:30]}")
    return out


def _api_json(obj: object) -> str:
    """Compact JSON for model prompts (saved work files still use indented dumps elsewhere)."""
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def translate_batch(model: str, system: str, title: str, batch: list[Segment], usage: Usage,
                    feedback: dict[str, str] | None = None) -> dict[str, str]:
    # On retry, only the flagged numbers are sent — resending the whole batch wastes Opus input tokens.
    keys = list(feedback) if feedback else [str(k + 1) for k in range(len(batch))]
    numbered = {n: batch[int(n) - 1].content_zh for n in keys}
    kinds = {n: batch[int(n) - 1].segment_type for n in keys if batch[int(n) - 1].segment_type != "prose"}
    user = f"Tác phẩm: {title}\n"
    if kinds:
        user += f"Loại câu đặc biệt (heading/byline/verse/dharani/item): {_api_json(kinds)}\n"
    notes = {n: batch[int(n) - 1].source_notes for n in keys if batch[int(n) - 1].source_notes}
    if notes:
        user += f"Chú thích hiệu khám của bản gốc: {_api_json(notes)}\n"
    if feedback:
        user += (
            "Người hiệu đính đã chỉ ra lỗi ở các câu sau. Hãy dịch lại CHỈ những câu này, sửa đúng lỗi đã nêu, "
            f"trả JSON chỉ gồm các số câu đó:\n{_api_json(feedback)}\n"
        )
    user += "\nNguyên văn:\n" + _api_json(numbered)
    raw, u, sec = chat(model, system, user)
    usage.add(model, u, sec)
    return {str(k): str(v) for k, v in parse_json(raw).items()}


# Headings / outlines / mantras gain little from style polish — skip to save credit.
_SKIP_POLISH_TYPES = frozenset({"heading", "byline", "item", "dharani"})


def polish_batch(model: str, system: str, title: str, batch: list[Segment], vi: dict[str, str],
                 usage: Usage, only: list[str] | None = None) -> dict[str, str]:
    """Cheap literary edit (usually Astra): prose/verse only; meaning unchanged."""
    keys = only or [str(k + 1) for k in range(len(batch)) if vi.get(str(k + 1), "").strip()]
    payload = []
    keep: list[str] = []
    for n in keys:
        i = int(n) - 1
        if not (0 <= i < len(batch)):
            continue
        text = vi.get(n, "").strip()
        if not text:
            continue
        kind = batch[i].segment_type
        if kind in _SKIP_POLISH_TYPES:
            continue
        row = {"n": n, "zh": batch[i].content_zh, "vi": text}
        if kind != "prose":
            row["type"] = kind
        payload.append(row)
        keep.append(n)
    if not payload:
        return {}
    user = (
        f"Tác phẩm: {title}\n"
        "Trả về đúng một object JSON {\"n\":\"vi đã chỉnh\",…} — không trả mảng.\n"
        + _api_json(payload)
    )
    raw, u, sec = chat(model, system, user)
    usage.add(model, u, sec)
    out = _polish_map(parse_json(raw))
    # Keep old text if polish dropped a sentence or returned empty.
    return {n: (out[n].strip() if out.get(n, "").strip() else vi[n]) for n in keep if n in vi}


def _polish_map(data) -> dict[str, str]:
    """Normalize polish JSON: object {"n":"vi"} or list [{"n","vi"}, …]."""
    if isinstance(data, dict):
        if "items" in data and isinstance(data["items"], list):
            data = data["items"]
        else:
            out: dict[str, str] = {}
            for k, v in data.items():
                if isinstance(v, dict) and ("vi" in v or "content_vi" in v):
                    out[str(v.get("n", k))] = str(v.get("vi") or v.get("content_vi") or "")
                else:
                    out[str(k)] = str(v)
            return out
    if isinstance(data, list):
        out = {}
        for item in data:
            if isinstance(item, dict) and item.get("n") is not None:
                out[str(item["n"])] = str(item.get("vi") or item.get("content_vi") or "")
        return out
    raise TypeError(f"polish JSON must be object or list, got {type(data).__name__}")


def review_batch(model: str, system: str, batch: list[Segment], vi: dict[str, str], usage: Usage) -> list[dict]:
    payload = [{"n": str(k + 1), "zh": s.content_zh, "vi": vi.get(str(k + 1), ""),
                **({"notes": s.source_notes} if s.source_notes else {})} for k, s in enumerate(batch)]
    raw, u, sec = chat(model, system, _api_json(payload), "HHTECH_REVIEW_API_KEY")
    usage.add(model, u, sec)
    result = parse_json(raw)
    return result.get("issues", []) if isinstance(result, dict) else result


def adjudicate(model: str, system: str, title: str, row: dict, before: list[str], after: list[str],
               usage: Usage, pool: str = "main") -> dict:
    payload = {"work": title, "context_before": before, "context_after": after,
               "zh": row["content_zh"], "vi": row["content_vi"], "review": row["open_issues"]}
    if row.get("source_notes"):
        payload["notes"] = row["source_notes"]
    if row.get("parallels"):
        payload["parallels"] = row["parallels"]
    if row.get("adjudication"):
        prior = row["adjudication"]
        payload["prior_judgement"] = {"original_vi": prior.get("previous_vi"), "decision": prior.get("decision"),
                                      "reason": prior.get("reason"), "model": prior.get("model"),
                                      "earlier": [{k: h.get(k) for k in ("model", "previous_vi", "decision", "reason")}
                                                  for h in row.get("adjudication_history", [])]}
    raw, u, sec = chat(model, system, _api_json(payload), pool=pool, fallback=False)
    usage.add(model, u, sec)
    result = parse_json(raw)
    if not str(result.get("final", "")).strip():
        raise KeyError("final")
    return result


def self_doubted(row: dict) -> bool:
    """Translator marked [?] on a row whose source text is intact (lost / illegible text is left as is)."""
    return (UNSURE_MARK in row["content_vi"] and LACUNA_MARK not in row["content_vi"]
            and ILLEGIBLE_CHAR not in row["content_zh"]
            and not any(LACUNA_NOTE.search(n) for n in row.get("source_notes") or []))


def confirm_self_doubted(opts: Options, title: str, rows: list[dict], context: list[dict], usage: Usage) -> int:
    """Judge rows the translator doubted ([?]) but nobody flagged, like reviewer-flagged rows:
    the translator model first, opts.confirmer only for those it is still unsure about."""
    if not opts.confirmer:
        return 0
    doubted = [r for r in rows if r["status"] != "flagged" and self_doubted(r) and not r.get("adjudication")]
    for r in doubted:
        r["status"] = "flagged"
        r["open_issues"] = r.get("open_issues") or [SELF_DOUBT_ISSUE]
    if doubted:
        adjudicate_rows(opts, title, doubted, context, usage)
    return len(doubted)


def adjudicate_rows(opts: Options, title: str, rows: list[dict], context: list[dict], usage: Usage,
                    model: str | None = None) -> None:
    """Resolve still-flagged rows in place; context is the batch (ordered rows) they were translated in.

    A row judged before keeps the earlier verdicts in adjudication_history and the new model sees them.
    Rows the model is still unsure about go to opts.confirmer; if that call fails they stay flagged
    for a later adjudicate_file.py --recheck-uncertain pass instead of failing the work.
    """
    system = (PROMPT_DIR / "adjudicate.md").read_text(encoding="utf-8")
    judges = opts.judges()
    model = model or (judges[0] if judges else opts.translator)
    level = judges.index(model) if model in judges else None
    later = judges[level + 1:] if level is not None else []
    index = {id(r): i for i, r in enumerate(context)}
    for row in rows:
        if row["status"] != "flagged":
            continue
        if (later or level) and (row.get("adjudication") or {}).get("model") in [model, *later]:
            continue
        i = index[id(row)]
        before = [r["content_zh"] for r in context[:i]]
        after = [r["content_zh"] for r in context[i + 1:]]
        result = with_retry(opts, adjudicate, model, system, title, row, before, after, usage,
                            "confirm" if model == opts.confirmer else "main")
        if row.get("adjudication"):
            row["adjudication"].setdefault("model", opts.translator)
            row.setdefault("adjudication_history", []).append(row["adjudication"])
        row["adjudication"] = {k: result.get(k) for k in ("decision", "reason", "confident")}
        row["adjudication"]["model"] = model
        row["adjudication"]["previous_vi"] = row["content_vi"]
        row["content_vi"] = str(result["final"]).strip()
        if result.get("confident") is not False:
            row["status"] = "ai_checked"

    if later:
        unsure = [r for r in rows if r["status"] == "flagged" and r.get("adjudication")]
        if unsure:
            try:
                adjudicate_rows(opts, title, unsure, context, usage, model=later[0])
            except (RuntimeError, urllib.error.HTTPError) as err:
                print(f"  {later[0]} confirm skipped, {len(unsure)} row(s) left flagged: {err}",
                      file=sys.stderr, flush=True)


def process_batch(opts: Options, prompts: tuple[str, str, str | None], title: str, batch: list[Segment],
                  usage: Usage) -> list[dict]:
    translate_system, review_system, polish_system = prompts
    vi = with_retry(opts, translate_batch, opts.translator, translate_system, title, batch, usage)
    if opts.polish_model and polish_system:
        polished = with_retry(opts, polish_batch, opts.polish_model, polish_system, title, batch, vi, usage)
        vi.update(polished)
    in_range = lambda n: n.isdigit() and 1 <= int(n) <= len(batch)  # noqa: E731
    missing = [str(k + 1) for k in range(len(batch)) if not vi.get(str(k + 1), "").strip()]
    issues = with_retry(opts, review_batch, opts.reviewer, review_system, batch, vi, usage)
    flagged = {str(i.get("n")): f'{i.get("type")}: {i.get("detail")}' for i in issues if in_range(str(i.get("n")))}
    for n in missing:
        flagged.setdefault(n, "thieu: chưa có bản dịch")

    retried: set[str] = set()
    still_flagged: dict[str, list[dict]] = {}
    if flagged:
        order = sorted(flagged, key=int)
        feedback = {n: f"{batch[int(n) - 1].content_zh}\n(bản dịch cũ: {vi.get(n, '')})\n(lỗi: {flagged[n]})"
                    for n in order}
        fixed = with_retry(opts, translate_batch, opts.translator, translate_system, title, batch, usage, feedback)
        for n, text in fixed.items():
            if n in flagged and text.strip():
                retried.add(n)
                vi[n] = text
        if opts.polish_model and polish_system and retried:
            polished = with_retry(opts, polish_batch, opts.polish_model, polish_system, title, batch, vi, usage,
                                  sorted(retried, key=int))
            vi.update(polished)
        sub = {str(k + 1): n for k, n in enumerate(order)}
        re_issues = with_retry(opts, review_batch, opts.reviewer, review_system,
                               [batch[int(n) - 1] for n in order], {k: vi.get(n, "") for k, n in sub.items()}, usage)
        for issue in re_issues:
            n = sub.get(str(issue.get("n")))
            if n:
                still_flagged.setdefault(n, []).append(issue)
        for n in order:
            if not vi.get(n, "").strip():
                still_flagged.setdefault(n, []).append({"type": "thieu", "detail": "chưa có bản dịch"})

    rows = []
    for k, seg in enumerate(batch):
        n = str(k + 1)
        rows.append({
            **asdict(seg),
            "content_vi": vi.get(n, ""),
            "status": "flagged" if n in still_flagged else "ai_checked",
            "retried": n in retried,
            "first_review": flagged.get(n),
            "open_issues": still_flagged.get(n, []),
        })
    # Judge inside each paragraph only (same as adjudicate_file) — full-batch context burns tokens.
    for _, group in groupby(rows, key=lambda r: (r["juan_no"], r["paragraph_no"])):
        paragraph = list(group)
        if any(r["status"] == "flagged" for r in paragraph) or any(self_doubted(r) for r in paragraph):
            adjudicate_rows(opts, title, paragraph, paragraph, usage)
            confirm_self_doubted(opts, title, paragraph, paragraph, usage)
    return rows


def render_markdown(work_code: str, title: str, opts: Options, segments: list[Segment], n_batches: int,
                    elapsed: float, usage: Usage, results: list[dict]) -> str:
    total_cjk = sum(len(CJK.findall(s.content_zh)) for s in segments)
    lines = [f"# {work_code} {title}\n"]
    polish = f" · Chỉnh văn: `{opts.polish_model}`" if opts.polish_model else ""
    lines.append(f"- Dịch: `{opts.translator}` · Soát: `{opts.reviewer}`{polish} · Mỗi lượt khoảng {opts.batch_chars} chữ")
    lines.append(f"- {len(segments)} câu · {total_cjk:,} chữ Hán · {n_batches} lượt · {elapsed / 60:.1f} phút")
    for model, row in usage.by_model.items():
        cr = usage.credits(model)
        cache_bits = ""
        if row.get("cache_read") or row.get("cache_write"):
            cache_bits = f" · cache read {int(row.get('cache_read') or 0):,} / write {int(row.get('cache_write') or 0):,}"
        lines.append(f"- `{model}`: {row['calls']} lần gọi · in {row['in']:,} / out {row['out']:,} tokens"
                     f"{cache_bits} · {'%.0f credit' % cr if cr is not None else 'chưa có giá'}")
    total = usage.total_credits()
    per_m = total / total_cjk * 1_000_000 if total_cjk else 0
    lines.append(f"- **Tổng: {total:,.0f} credit** · ≈ {per_m:,.0f} credit / 1 triệu chữ Hán")
    open_count = sum(1 for r in results if r["status"] == "flagged")
    lines.append(f"- AI soát: {sum(1 for r in results if r['retried'])} câu đã dịch lại · "
                 f"{open_count} câu còn cần người duyệt\n")

    para: list[str] = []
    current_juan = current_para = None

    def flush() -> None:
        if para:
            lines.append(" ".join(para) + "\n")
            para.clear()

    previous_type = None
    for r in results:
        if previous_type == "item" and r["segment_type"] != "item":
            lines.append("")  # end the markdown list so the next line is not folded into it
        previous_type = r["segment_type"]
        if r["juan_no"] != current_juan:
            flush()
            lines.append(f"\n---\n\n## Quyển {r['juan_label'] or 'tựa'}\n")
            current_juan = r["juan_no"]
        if r["paragraph_no"] != current_para:
            flush()
            current_para = r["paragraph_no"]
        text = r["content_vi"] + (" ⚠️" if r["status"] == "flagged" else "")
        if r["segment_type"] == "heading":
            flush()
            lines.append(f"### {text}\n")
        elif r["segment_type"] in ("verse", "byline", "dharani"):
            flush()
            lines.append(f"{text}  ")
        elif r["segment_type"] == "item":
            flush()
            lines.append(f"{'  ' * max((r.get('heading_level') or 1) - 1, 0)}- {text}")
        else:
            para.append(text)
    flush()

    judged = [r for r in results if r.get("adjudication")]
    if judged:
        lines.append(f"\n---\n\n## Câu đã được AI thẩm định ({len(judged)})\n")
        for r in judged:
            a = r["adjudication"]
            lines.append(f"- [{r['cbeta_ref']}] `{a.get('model') or opts.translator}` {r['content_zh']}\n"
                         f"  → Bản cũ: {a['previous_vi']}\n  "
                         f"→ **Bản chốt:** {r['content_vi']}\n  → {a.get('decision')}: {a.get('reason')}")

    if open_count:
        lines.append("\n---\n\n## Câu cần người duyệt\n")
        for r in results:
            if r["status"] == "flagged":
                lines.append(f"- [{r['cbeta_ref']}] {r['content_zh']}\n  → {r['content_vi']}\n  "
                             f"→ {json.dumps(r['open_issues'], ensure_ascii=False)}")
    return "\n".join(lines)


def translate_file(xml_path: Path, out_dir: Path, opts: Options) -> dict:
    """Translate one XML file, resuming from its checkpoint. Returns a usage summary."""
    canon = xml_path.parent.parent.name
    segments = parse_file(xml_path, canon)
    title = work_title(xml_path) or xml_path.stem
    work_code = re.sub(r"^[A-Z]+\d+n", canon, xml_path.stem)
    polish_path = PROMPT_DIR / "polish.md"
    prompts = (
        (PROMPT_DIR / "translate.md").read_text(encoding="utf-8"),
        (PROMPT_DIR / "review.md").read_text(encoding="utf-8"),
        polish_path.read_text(encoding="utf-8") if opts.polish_model and polish_path.exists() else None,
    )
    all_batches = batches(segments, opts.batch_chars)

    out_dir.mkdir(parents=True, exist_ok=True)
    partial = out_dir / f"{xml_path.stem}.partial.json"
    state = json.loads(partial.read_text(encoding="utf-8")) if partial.exists() else {}
    # Checkpointed rows are matched by content, not batch index, so a parser change cannot misplace them.
    slots = align(segments, state.get("results", []))
    position = {id(seg): i for i, seg in enumerate(segments)}
    pending = batches([seg for seg, row in zip(segments, slots) if row is None], opts.batch_chars)
    usage = Usage(state.get("usage"))
    elapsed_before: float = state.get("elapsed", 0.0)
    started = time.time()
    done_before = sum(1 for row in slots if row is not None)
    if done_before:
        print(f"  resume {xml_path.stem}: {done_before}/{len(segments)} rows done, "
              f"{len(pending)} batch(es) to go", file=sys.stderr, flush=True)

    checkpoint = threading.Lock()
    done_batches = 0

    def run_batch(batch: list[Segment]) -> None:
        nonlocal done_batches
        if opts.deadline is not None and time.time() >= opts.deadline:
            raise StopRequested(f"{xml_path.stem} paused with {len(pending) - done_batches} batch(es) left")
        batch_usage = Usage()
        rows = process_batch(opts, prompts, title, batch, batch_usage)
        with checkpoint:
            for seg, row in zip(batch, rows):
                slots[position[id(seg)]] = row
            for model, row in batch_usage.by_model.items():
                acc = usage.by_model.setdefault(
                    model, {"calls": 0, "in": 0, "out": 0, "cache_read": 0, "cache_write": 0, "seconds": 0.0},
                )
                for k, v in row.items():
                    acc[k] = (acc.get(k) or 0) + v
            done_batches += 1
            state = {"done_batches": done_batches, "pending_batches": len(pending),
                     "results": [r for r in slots if r is not None], "usage": usage.by_model,
                     "elapsed": elapsed_before + time.time() - started}
            partial.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
            # Per-batch cache only (cumulative from old runs with cache ON is misleading).
            # Fable never sends cache markers; other models only when CANON_PROMPT_CACHE=1.
            cache_r = sum(int(r.get("cache_read") or 0) for name, r in batch_usage.by_model.items()
                          if "fable" not in name.lower())
            cache_w = sum(int(r.get("cache_write") or 0) for name, r in batch_usage.by_model.items()
                          if "fable" not in name.lower())
            cache_note = f" · cache r{cache_r:,}/w{cache_w:,}" if (cache_r or cache_w) else ""
            print(f"  {xml_path.stem} batch {done_batches}/{len(pending)} · "
                  f"{usage.total_credits():,.0f} credit{cache_note}", file=sys.stderr, flush=True)

    if opts.batch_workers > 1:
        with ThreadPoolExecutor(max_workers=opts.batch_workers) as pool:
            for fut in [pool.submit(run_batch, b) for b in pending]:
                fut.result()
    else:
        for batch in pending:
            run_batch(batch)
    results: list[dict] = [row for row in slots if row is not None]

    # Rows flagged by batches that ran before adjudication existed (checkpoint resume).
    paragraphs: dict[tuple, list[dict]] = {}
    for r in results:
        paragraphs.setdefault((r["juan_no"], r["paragraph_no"]), []).append(r)
    for paragraph in paragraphs.values():
        if any(r["status"] == "flagged" and not r.get("adjudication") for r in paragraph):
            adjudicate_rows(opts, title, [r for r in paragraph if not r.get("adjudication")], paragraph, usage)

    elapsed = elapsed_before + time.time() - started
    (out_dir / f"{xml_path.stem}.json").write_text(json.dumps({
        "work_code": work_code, "title_zh": title, "source": str(xml_path.name),
        "translator": opts.translator, "reviewer": opts.reviewer,
        "usage": usage.by_model, "elapsed": elapsed, "segments": results,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    md_path = out_dir / f"{xml_path.stem}.md"
    md_path.write_text(
        render_markdown(work_code, title, opts, segments, len(all_batches), elapsed, usage, results), encoding="utf-8")
    write_bilingual_markdown(md_path, work_code, title, results)
    partial.unlink(missing_ok=True)
    return {
        "file": xml_path.stem, "work_code": work_code, "title": title,
        "cjk": sum(len(CJK.findall(s.content_zh)) for s in segments),
        "credits": usage.total_credits(), "elapsed": elapsed,
        "flagged": sum(1 for r in results if r["status"] == "flagged"),
    }


def add_common_args(ap: argparse.ArgumentParser) -> None:
    ap.add_argument("--translator", required=True)
    ap.add_argument("--reviewer", required=True)
    ap.add_argument("--batch-chars", type=int, required=True, help="Target source characters per request")
    ap.add_argument("--max-attempts", type=int, required=True, help="Attempts per API call on transient errors")
    ap.add_argument("--retry-wait", type=int, required=True, help="Base seconds between retries (× attempt)")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--stop-at", help="Local time 'YYYY-MM-DD HH:MM'; no new batch starts after it")
    ap.add_argument("--arbiter", help="Model that re-judges sentences the translator is unsure about, "
                                      "before --confirmer")
    ap.add_argument("--confirmer", help="Model that re-judges sentences the adjudicator is unsure about")
    ap.add_argument("--batch-workers", type=int, default=1,
                    help="Batches of one work translated in parallel (each batch is self-contained)")
    ap.add_argument("--polish-model",
                    help="Optional second-pass model (e.g. same as --translator) to polish Buddhist literary style")


def options_from(args: argparse.Namespace) -> Options:
    deadline = time.mktime(time.strptime(args.stop_at, "%Y-%m-%d %H:%M")) if args.stop_at else None
    return Options(args.translator, args.reviewer, args.batch_chars, args.max_attempts, args.retry_wait, deadline,
                   args.confirmer, args.batch_workers, args.arbiter, getattr(args, "polish_model", None))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--xml", required=True)
    add_common_args(ap)
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[2]
    load_env(root / ".env")
    summary = translate_file(root / args.xml, Path(args.out_dir).expanduser(), options_from(args))
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as err:
        sys.exit(f"HTTP {err.code}: {err.read().decode(errors='ignore')}")
