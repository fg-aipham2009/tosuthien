"""Parse CBETA TEI P5 XML into ordered segments (heading / byline / prose sentence / verse line).

Blocks come from the XML structure first (cb:jhead, head, byline, p, l); prose blocks are then
split into sentences. Each segment keeps the CBETA line reference of the edition it was read from.
"""
from __future__ import annotations

import hashlib
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

TEI = "{http://www.tei-c.org/ns/1.0}"
CB = "{http://www.cbeta.org/ns/1.0}"
XML_NS = "{http://www.w3.org/XML/1998/namespace}"

# Elements whose text is never part of the reading text.
SKIP = {
    f"{TEI}teiHeader", f"{CB}mulu", f"{CB}docNumber", f"{TEI}rdg", f"{TEI}pb",
    f"{TEI}anchor", f"{TEI}figure", f"{TEI}graphic", f"{CB}fn",
}
# Block elements that become their own segment(s).
BLOCKS = {
    f"{CB}jhead": "heading",
    f"{TEI}head": "heading",
    f"{TEI}byline": "byline",
    f"{TEI}p": "prose",
    f"{TEI}l": "verse",
}
# Elements whose own text is reading text but which may also hold blocks or nested lists
# (科文 outlines, tables, glossary entries); each run of their own text becomes an "item" segment.
CONTAINERS = {f"{TEI}item", f"{TEI}cell", f"{TEI}form"}
# Children of a container that are walked as structure instead of being read inline.
STRUCTURE = set(BLOCKS) | CONTAINERS | {
    f"{TEI}list", f"{TEI}table", f"{TEI}row", f"{TEI}lg", f"{TEI}entry", f"{TEI}sense", f"{TEI}div",
    f"{CB}div", f"{CB}juan",
}
SENTENCE_END = re.compile(r"(?<=[。？！])(?![」』）〉》”’])|(?<=[。？！][」』）〉》”’])")
# CBETA's own numbering of prefaces / appendices (e.g. "No. 1217-A"), not part of the source text.
CBETA_NUMBER_PREFIX = re.compile(r"^((?:\x02[^\x03]*\x03)*)No\.\s*\d+[A-Za-z0-9-]*")
# Line-break markers kept inside block text so each sentence gets the line it starts on.
REF_MARK = re.compile(r"\x02([^\x03]*)\x03")
# Position markers of the original edition's collation notes (e.g. 「三下佚失原本…一紙」, 「一下疑脫切字」).
NOTE_MARK = re.compile(r"\x04(\d+)\x05")
# Characters before a note marker quoted with the note, so the translator knows where it applies.
NOTE_CONTEXT_CHARS = 6


@dataclass
class Segment:
    juan_no: int
    juan_label: str
    seq: int
    paragraph_no: int
    segment_type: str
    content_zh: str
    cbeta_ref: str | None
    heading_level: int | None = None
    source_notes: list[str] = field(default_factory=list)
    content_hash: str = field(init=False)

    def __post_init__(self) -> None:
        self.content_hash = hashlib.sha1(self.content_zh.encode("utf-8")).hexdigest()


def _gaiji_table(root: ET.Element) -> dict[str, str]:
    table: dict[str, str] = {}
    for char in root.iter(f"{TEI}char"):
        cid = char.get(f"{XML_NS}id")
        value = None
        for mapping in char.findall(f"{TEI}mapping"):
            if mapping.get("type") == "unicode" and mapping.text:
                value = chr(int(mapping.text.strip()[2:], 16))
        if value is None:
            for prop in char.findall(f"{TEI}charProp"):
                if prop.findtext(f"{TEI}localName") in ("normalized form", "composition"):
                    value = prop.findtext(f"{TEI}value")
                    break
        if cid and value:
            table[cid] = value
    return table


def _orig_notes(root: ET.Element) -> dict[str, str]:
    """Anchor id -> text of the original edition's collation note (type="orig") pointing at it."""
    notes: dict[str, str] = {}
    for note in root.iter(f"{TEI}note"):
        target = (note.get("target") or "").lstrip("#")
        text = "".join(note.itertext()).strip()
        if note.get("type") == "orig" and target and text:
            notes.setdefault(target, text)
    return notes


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in SENTENCE_END.split(text) if s and s.strip()]


class _Walker:
    def __init__(self, root: ET.Element, edition: str) -> None:
        self.edition = edition
        self.gaiji = _gaiji_table(root)
        self.orig_notes = _orig_notes(root)
        self.note_texts: list[str] = []
        self.juan_no = 0
        self.juan_label = ""
        self.line_ref: str | None = None
        self.segments: list[Segment] = []
        self.seq_by_juan: dict[int, int] = {}
        self.paragraph_by_juan: dict[int, int] = {}
        self.div_depth = 0
        self.list_depth = 0

    def _emit(self, kind: str, text: str, ref: str | None, level: int | None, by_line: bool = False) -> None:
        if kind == "dharani":
            # Full-width spaces separate mantra phrases; keep them, drop line wrapping only.
            text = re.sub(r"[\u3000 ]+", " ", re.sub(r"[\t\r\n]+", "", text)).strip()
        else:
            text = re.sub(r"\s+", "", text.replace("\u3000", ""))
        if kind == "heading":
            text = CBETA_NUMBER_PREFIX.sub(r"\1", text)
        plain = NOTE_MARK.sub("", REF_MARK.sub("", text))
        if not plain:
            return
        juan = self.juan_no
        para = self.paragraph_by_juan.get(juan, 0) + 1
        self.paragraph_by_juan[juan] = para
        if kind != "prose":
            parts = [text]
        elif by_line or not re.search(r"[。？！]", plain):
            # Preformatted or unpunctuated source: follow the original line breaks.
            parts = re.split(r"(?=\x02)", text)
        else:
            parts = split_sentences(text)
        current_ref = ref
        previous: Segment | None = None
        for part in parts:
            lead = re.match(r"(?:\x02[^\x03]*\x03)+", part)
            if lead:
                current_ref = REF_MARK.findall(lead.group(0))[-1]
            sentence_ref = current_ref
            refs_in_part = REF_MARK.findall(part)
            if refs_in_part:
                current_ref = refs_in_part[-1]
            marked = REF_MARK.sub("", part)
            # A note anchored right after the previous sentence's final punctuation belongs to that sentence.
            leading = re.match(r"(?:\x04\d+\x05)+", marked)
            if leading and previous is not None:
                previous.source_notes += [f"「{previous.content_zh[-NOTE_CONTEXT_CHARS:]}」: {self.note_texts[int(i)]}"
                                          for i in NOTE_MARK.findall(leading.group(0))]
                marked = marked[leading.end():]
            notes: list[str] = []
            for m in NOTE_MARK.finditer(marked):
                before = NOTE_MARK.sub("", marked[:m.start()])[-NOTE_CONTEXT_CHARS:]
                notes.append(f"「{before}」: {self.note_texts[int(m.group(1))]}" if before
                             else f"(đầu câu): {self.note_texts[int(m.group(1))]}")
            clean = NOTE_MARK.sub("", marked)
            if not clean:
                continue
            seq = self.seq_by_juan.get(juan, 0) + 1
            self.seq_by_juan[juan] = seq
            previous = Segment(juan, self.juan_label, seq, para, kind, clean, sentence_ref,
                               level if kind in ("heading", "item") else None, notes)
            self.segments.append(previous)

    def _text(self, node: ET.Element) -> str:
        """Inline text of a block, following lb for refs and resolving gaiji / variants / notes."""
        parts: list[str] = [node.text or ""]
        for child in node:
            parts.append(self._inline(child))
            parts.append(child.tail or "")
        return "".join(parts)

    def _inline(self, child: ET.Element) -> str:
        tag = child.tag
        if tag == f"{TEI}lb":
            if child.get("ed") == self.edition:
                self.line_ref = child.get("n")
                return f"\x02{self.line_ref}\x03"
        elif tag == f"{TEI}note":
            if child.get("place") == "inline":
                return "（" + self._text(child) + "）"
        elif tag == f"{TEI}g":
            return child.text or self.gaiji.get((child.get("ref") or "").lstrip("#"), "")
        elif tag == f"{TEI}anchor" and child.get(f"{XML_NS}id") in self.orig_notes:
            self.note_texts.append(self.orig_notes[child.get(f"{XML_NS}id")])
            return f"\x04{len(self.note_texts) - 1}\x05"
        elif tag in SKIP or tag == f"{TEI}caesura":
            pass
        else:
            return self._text(child)
        return ""

    def _container(self, node: ET.Element) -> None:
        """Own text of an item / cell / form; nested blocks and lists are walked in reading order."""
        level = self.list_depth if node.tag == f"{TEI}item" else 0
        ref = self.line_ref
        parts: list[str] = [node.text or ""]
        for child in node:
            if child.tag in STRUCTURE:
                self._emit("item", "".join(parts), ref, level)
                self._visit(child)
                parts, ref = [], self.line_ref
            else:
                parts.append(self._inline(child))
            parts.append(child.tail or "")
        self._emit("item", "".join(parts), ref, level)

    def walk(self, node: ET.Element) -> None:
        for child in node:
            self._visit(child)

    def _visit(self, child: ET.Element) -> None:
        tag = child.tag
        if tag == f"{TEI}lb":
            if child.get("ed") == self.edition:
                self.line_ref = child.get("n")
        elif tag == f"{CB}juan":
            if child.get("fun") == "open":
                # juan_no is the order within this file; juan_label is CBETA's own n (e.g. "001a").
                self.juan_no += 1
                self.juan_label = child.get("n") or str(self.juan_no)
            # Closing juan lines (e.g. 「…經卷下終」) and bylines inside cb:juan are source text too.
            for part in child:
                if part.tag == f"{CB}jhead":
                    self._emit("heading", self._text(part), self.line_ref, 0)
                else:
                    self._visit(part)
        elif tag in BLOCKS:
            ref = self.line_ref
            kind = BLOCKS[tag]
            cb_type = child.get(f"{CB}type")
            if kind == "prose" and cb_type == "dharani":
                kind = "dharani"
            level = self.div_depth if kind == "heading" else None
            self._emit(kind, self._text(child), ref, level, by_line=cb_type == "pre")
        elif tag in CONTAINERS:
            self._container(child)
        elif tag == f"{TEI}list":
            self.list_depth += 1
            self.walk(child)
            self.list_depth -= 1
        elif tag == f"{CB}div":
            self.div_depth += 1
            self.walk(child)
            self.div_depth -= 1
        elif tag in SKIP or tag == f"{TEI}note":
            pass
        else:
            self.walk(child)


def work_title(path: Path) -> str | None:
    """Monograph title from the TEI header (title level="m")."""
    for title in ET.parse(path).getroot().iter(f"{TEI}title"):
        if title.get("level") == "m" and title.text:
            return title.text.strip()
    return None


def parse_file(path: Path, edition: str) -> list[Segment]:
    """Return segments of one CBETA XML file; edition is the canon code used in lb/@ed (e.g. 'X')."""
    root = ET.parse(path).getroot()
    body = root.find(f".//{TEI}body")
    walker = _Walker(root, edition)
    if body is not None:
        walker.walk(body)
    return walker.segments
