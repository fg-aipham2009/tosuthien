#!/usr/bin/env python3
"""Look up whether Rộng Mở Tâm Hồn (rongmotamhon.net) already has a Vietnamese translation.

Match CBETA X stems via RMTH's Hán-tạng search (find_name) → "tập Xnn … kinh số N".
A hit counts only when the result (or its mục lục) exposes a viet1 / 「Việt dịch」 link.
Network/parse failures fail open (treat as not found) so translation still proceeds.
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

UA = {"User-Agent": "Mozilla/5.0 (tosuthien-canon-bot; +local)"}
SEARCH_URL = "https://rongmotamhon.net/kinh-bac-truyen_ket-qua_tim-kiem_kinh.html"
BASE = "https://rongmotamhon.net"

STEM_RE = re.compile(r"^([A-Z]+)(\d+)n0*(\d+)")
RESULT_RE = re.compile(
    r"tập\s*([A-Z])(\d+)\s*\([^)]*\),\s*kinh số\s*(\d+)",
    re.I,
)


def stem_parts(stem: str) -> tuple[str, int, int] | None:
    m = STEM_RE.match(stem)
    if not m:
        return None
    return m.group(1), int(m.group(2)), int(m.group(3))


def _encode_url(url: str) -> str:
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, quote(p.path, safe="/"), p.query, p.fragment))


def _get(url: str, timeout: float = 30) -> str:
    req = urllib.request.Request(_encode_url(url), headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read().decode("utf-8", "replace")


def _post_find_name(title_zh: str, timeout: float = 30) -> str:
    data = urllib.parse.urlencode({"find_name": title_zh}).encode()
    req = urllib.request.Request(
        SEARCH_URL, data=data,
        headers={**UA, "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read().decode("utf-8", "replace")


def _abs(href: str) -> str:
    if href.startswith("http"):
        return href
    return f"{BASE}/{href.lstrip('/')}"


def _li_has_viet(li_html: str) -> tuple[bool, str | None]:
    hrefs = re.findall(r"href=['\"]([^'\"]+)['\"]", li_html)
    for href in hrefs:
        if "viet1" in href or re.search(r"_viet\d*\.html", href):
            return True, _abs(href)
    if re.search(r"Việt dịch\s*\(?\d*\)?", li_html):
        for href in hrefs:
            if "muc-luc" in href or "viet" in href.lower():
                return True, _abs(href)
        return True, _abs(hrefs[0]) if hrefs else None
    return False, None


def _muc_luc_has_viet(url: str) -> tuple[bool, str | None]:
    try:
        html = _get(url)
    except (urllib.error.URLError, TimeoutError, OSError):
        return False, None
    hrefs = re.findall(r"href=['\"]([^'\"]*viet1[^'\"]*)['\"]", html)
    if hrefs:
        return True, _abs(hrefs[0])
    if "Việt dịch" in html and "viet1" in html:
        return True, url
    return False, None


def lookup_vietnamese(stem: str, title_zh: str) -> dict:
    """Return {stem, title_zh, has_viet, url, note} for one CBETA work."""
    parts = stem_parts(stem)
    out: dict = {
        "stem": stem, "title_zh": title_zh, "has_viet": False,
        "url": None, "note": "", "checked_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    if not title_zh or not parts:
        out["note"] = "no title or unparsable stem"
        return out
    canon, vol, num = parts
    try:
        html = _post_find_name(title_zh.strip())
    except (urllib.error.URLError, TimeoutError, OSError) as err:
        out["note"] = f"search failed: {err!r}"
        return out

    for li in re.findall(r"<li[^>]*>(.*?)</li>", html, re.S):
        if "xem-kinh" not in li:
            continue
        text = re.sub(r"<[^>]+>", " ", li)
        text = re.sub(r"\s+", " ", text).strip()
        m = RESULT_RE.search(text)
        if not m:
            continue
        if m.group(1).upper() != canon or int(m.group(2)) != vol or int(m.group(3)) != num:
            continue
        has_viet, url = _li_has_viet(li)
        if not has_viet:
            # Result may only link to mục lục — open it once.
            for href in re.findall(r"href=['\"]([^'\"]*muc-luc[^'\"]*)['\"]", li):
                has_viet, url = _muc_luc_has_viet(_abs(href))
                if has_viet:
                    break
        out["has_viet"] = has_viet
        out["url"] = url
        out["note"] = "matched X + kinh số" + (" · có Việt dịch" if has_viet else " · chỉ Hán/phiên âm")
        return out

    out["note"] = "no matching X entry on RMTH"
    return out


def cache_path(out_dir: Path) -> Path:
    return out_dir / "_rmth_cache.json"


def load_cache(out_dir: Path) -> dict:
    path = cache_path(out_dir)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_cache(out_dir: Path, cache: dict) -> None:
    cache_path(out_dir).write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")


def should_skip_new_work(stem: str, title_zh: str, out_dir: Path, *, force: bool = False) -> dict:
    """Cached lookup. Returns lookup dict; caller skips when has_viet is True."""
    cache = load_cache(out_dir)
    if not force and stem in cache and "has_viet" in cache[stem]:
        return cache[stem]
    result = lookup_vietnamese(stem, title_zh)
    cache[stem] = result
    save_cache(out_dir, cache)
    return result


def write_skip_marker(out_dir: Path, result: dict) -> Path:
    path = out_dir / f"{result['stem']}.rmth.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    return path


def extract_vietdich(html: str) -> str:
    """Pull the readable Vietnamese body from an RMTH viet1 page (#vietdich)."""
    m = re.search(r'<div[^>]*id=["\']vietdich["\'][^>]*>', html, re.I)
    if not m:
        return ""
    start = m.end()
    depth = 1
    j = start
    inner = ""
    while j < len(html) and depth:
        open_m = re.search(r"<div\b", html[j:], re.I)
        close_m = re.search(r"</div>", html[j:], re.I)
        if close_m is None:
            inner = html[start:]
            break
        open_pos = open_m.start() if open_m else None
        close_pos = close_m.start()
        if open_pos is not None and open_pos < close_pos:
            depth += 1
            j += open_pos + 4
            continue
        depth -= 1
        if depth == 0:
            inner = html[start : j + close_pos]
            break
        j += close_pos + 6
    text = re.sub(r"<br\s*/?>", "\n", inner, flags=re.I)
    text = re.sub(r"</p\s*>", "\n\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    for a, b in (("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')):
        text = text.replace(a, b)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _viet_links_in(html: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for href in re.findall(r"href=['\"]([^'\"]*viet\d*[^'\"]*\.html)['\"]", html, re.I):
        url = _abs(href)
        if url not in seen and re.search(r"_viet\d*\.html", url, re.I):
            seen.add(url)
            found.append(url)
    return found


def discover_viet_urls(stem: str, title_zh: str, seed_url: str | None = None) -> list[str]:
    """Ordered list of RMTH Việt-dịch page URLs for this exact X stem."""
    parts = stem_parts(stem)
    urls: list[str] = []
    seen: set[str] = set()

    def add(url: str | None) -> None:
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    add(seed_url)
    if not parts or not title_zh:
        return urls
    canon, vol, num = parts
    try:
        html = _post_find_name(title_zh.strip())
    except (urllib.error.URLError, TimeoutError, OSError):
        return urls

    for li in re.findall(r"<li[^>]*>(.*?)</li>", html, re.S):
        if "xem-kinh" not in li:
            continue
        text = re.sub(r"<[^>]+>", " ", li)
        text = re.sub(r"\s+", " ", text).strip()
        m = RESULT_RE.search(text)
        if not m:
            continue
        if m.group(1).upper() != canon or int(m.group(2)) != vol or int(m.group(3)) != num:
            continue
        for href in re.findall(r"href=['\"]([^'\"]+)['\"]", li):
            abs_url = _abs(href)
            if re.search(r"_viet\d*\.html", abs_url, re.I):
                add(abs_url)
            elif "muc-luc" in abs_url:
                try:
                    muc = _get(abs_url)
                except (urllib.error.URLError, TimeoutError, OSError):
                    continue
                for u in _viet_links_in(muc):
                    add(u)
        break

    # Follow in-page sibling viet links (multi-page works) from each seed.
    for url in list(urls):
        try:
            page = _get(url)
        except (urllib.error.URLError, TimeoutError, OSError):
            continue
        for u in _viet_links_in(page):
            # Keep only pages that look like the same work (share path prefix before _viet).
            base = re.sub(r"_viet\d*\.html$", "", url, flags=re.I)
            if u.startswith(base.rsplit("_", 1)[0]) or re.sub(r"_viet\d*\.html$", "", u, flags=re.I).startswith(
                re.sub(r"_[a-z0-9]+$", "", base, flags=re.I)[:40]
            ):
                add(u)
            elif stem.replace("n", "_").lower() in u.lower() or f"{vol}_{num}" in u:
                add(u)
    return urls


def fetch_vietnamese_text(stem: str, title_zh: str, seed_url: str | None = None) -> dict:
    """Download and concatenate all viet1 bodies for a work.

    Returns {urls, text, chars, pages, note}.
    """
    urls = discover_viet_urls(stem, title_zh, seed_url=seed_url)
    if not urls and seed_url:
        urls = [seed_url]
    parts: list[str] = []
    ok_urls: list[str] = []
    for url in urls:
        try:
            html = _get(url)
        except (urllib.error.URLError, TimeoutError, OSError) as err:
            return {
                "urls": urls, "text": "\n\n".join(parts), "chars": sum(len(p) for p in parts),
                "pages": len(parts), "note": f"fetch failed {url}: {err!r}",
            }
        body = extract_vietdich(html)
        if body:
            parts.append(body)
            ok_urls.append(url)
    text = "\n\n".join(parts).strip()
    return {
        "urls": ok_urls or urls,
        "text": text,
        "chars": len(text),
        "pages": len(parts),
        "note": "ok" if text else "empty vietdich",
    }
