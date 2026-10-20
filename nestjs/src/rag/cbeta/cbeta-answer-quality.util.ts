import type { CbetaAnswerLang } from './cbeta-intent.util';

const VI_MARK_RE =
  /[àáạảãăằắặẳẵâầấậẩẫèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

/** Strip known assistant prefills before judging model / answer body language. */
export function stripCbetaAnswerPrefill(text: string): string {
  return (text || '')
    .replace(/^PHẦN\s*1\s*/i, '')
    .replace(/^第一部分\s*/i, '')
    .replace(/^PART\s*1\s*/i, '')
    .replace(/^Dưới đây là các vị tổ trong phạm vi đã quét:\s*/i, '')
    .replace(/^以下依已掃範圍列出祖師：\s*/i, '')
    .replace(/^Patriarchs in the scanned scope:\s*/i, '')
    .replace(/^Thiền\s*\(禪\),\s*theo ngữ cảnh CBETA dưới đây,\s*/i, '')
    .replace(
      /^Chan\s*\(禪\),\s*according to the CBETA passages below,\s*/i,
      '',
    )
    .replace(/^禪（定慧之學）在本段 CBETA 語境中，\s*/u, '')
    .trim();
}

/**
 * Remove leading LLM scaffolding so the visible answer starts with content.
 * When lang=vi, also drop leading English CoT sentences until Vietnamese appears.
 */
export function stripLeadingMetaPlanning(
  text: string,
  lang?: CbetaAnswerLang,
): string {
  let t = text || '';
  for (let i = 0; i < 6; i++) {
    const next = t
      .replace(/^Tôi cần[^.\n]*?[.:：]\s*/i, '')
      .replace(/^Tôi sẽ[^.\n]*?[.:：]\s*/i, '')
      .replace(/^Tôi đang[^.\n]*?[.:：]\s*/i, '')
      .replace(/^Mình cần[^.\n]*?[.:：]\s*/i, '')
      .replace(/^Để trả lời[^.\n]*?[.:：]\s*/i, '')
      .replace(/^Trả lời bằng tiếng[^.\n]*?[.:：]\s*/i, '')
      .replace(/^I (?:need to|also want to|want to|am going to|will)[\s\S]{0,500}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^I'm (?:noting|starting|outlining|looking|thinking|going)[\s\S]{0,500}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^Next I'm[\s\S]{0,400}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^Let me[\s\S]{0,400}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^Looking at[\s\S]{0,400}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^First[, ][\s\S]{0,400}?(?:—|–|:|\.\s+)/i, '');
    if (next === t) break;
    t = next;
  }
  t = t.replace(/^\s+/, '');
  if (lang === 'en') {
    // Drop first-person planning sentences until a content noun phrase.
    for (let i = 0; i < 4; i++) {
      if (!/^(I'm |I |Next I'm )/i.test(t)) break;
      const cut = t.search(/[.?!]\s+/);
      if (cut < 0 || cut > 500) break;
      t = t.slice(cut + 1).replace(/^\s+/, '');
    }
  }
  if (lang === 'vi') {
    // Drop pure-English lead-in until a Vietnamese diacritic shows up.
    for (let i = 0; i < 4; i++) {
      if (!t || VI_MARK_RE.test(t.slice(0, 48))) break;
      if (!/^[A-Za-zI]/.test(t)) break;
      const cut = t.search(/[.?!。]\s+/);
      if (cut < 0 || cut > 500) {
        const dropped = t.replace(
          /^I [\s\S]{0,500}?(?=[A-ZÀ-ỹ]|Thiền|Theo|Trong|Định)/,
          '',
        );
        if (dropped === t) break;
        t = dropped.replace(/^\s+/, '');
      } else {
        t = t.slice(cut + 1).replace(/^\s+/, '');
      }
    }
  }
  return t;
}

/** Whether the stream head buffer should keep collecting before first yield. */
export function shouldBufferCbetaHead(
  headBuf: string,
  lang: CbetaAnswerLang,
): boolean {
  if (headBuf.length < 80) return true;
  const cleaned = stripLeadingMetaPlanning(headBuf, lang);
  if (isMetaPlanningOpener(cleaned)) return headBuf.length < 600;
  if (lang === 'vi') {
    const h = cleaned.slice(0, 80);
    if (/^[A-Za-z]/.test(h) && !VI_MARK_RE.test(h)) {
      return headBuf.length < 700;
    }
  }
  if (lang === 'en' && /^(I'm |I need |Next I'm )/i.test(cleaned)) {
    return headBuf.length < 700;
  }
  return false;
}

/**
 * True when the answer opens with LLM meta / planning instead of content.
 * Covers English CoT and Vietnamese "Tôi cần trả lời…" scaffolding.
 */
export function isMetaPlanningOpener(text: string): boolean {
  const head = stripCbetaAnswerPrefill(text).slice(0, 180);
  if (!head) return false;
  // Do not treat lowercase "the …" (continuation after prefill) as meta.
  if (
    /^(The (question|context|entity|user|answer|passage|list)\b|I['’ ]|I'm |I am |Here |According to|In the |This question|Looking |Based on|Note that|Let me|First[, ])/i.test(
      head,
    )
  ) {
    return true;
  }
  if (
    /\b(I'm noting|I need to|entity list|noisy and full|context block|unrelated)\b/i.test(
      head,
    )
  ) {
    return true;
  }
  // Vietnamese scaffolding that is not the answer itself.
  if (
    /^(Tôi cần|Tôi sẽ|Tôi đang|Mình cần|Để trả lời|Trả lời bằng tiếng)/i.test(
      head,
    )
  ) {
    return true;
  }
  return false;
}

export type AssertCbetaAnswerLangResult = {
  ok: boolean;
  reason?: string;
  head: string;
};

/**
 * Quality gate for streamed / deterministic answers.
 * Does not invent length caps — only language + anti-CoT checks.
 */
export function assertCbetaAnswerLang(
  text: string,
  lang: CbetaAnswerLang,
): AssertCbetaAnswerLangResult {
  const body = stripCbetaAnswerPrefill(text);
  const head = body.slice(0, 160);
  if (body.length < 20) {
    return { ok: false, reason: 'too_short', head };
  }
  if (isMetaPlanningOpener(text)) {
    return { ok: false, reason: 'meta_planning', head };
  }
  if (lang === 'vi') {
    if (!VI_MARK_RE.test(body)) {
      return { ok: false, reason: 'missing_vi_marks', head };
    }
    return { ok: true, head };
  }
  if (lang === 'zh') {
    if (!CJK_RE.test(body)) {
      return { ok: false, reason: 'missing_cjk', head };
    }
    if (VI_MARK_RE.test(body.slice(0, 80))) {
      return { ok: false, reason: 'unexpected_vi', head };
    }
    return { ok: true, head };
  }
  // en
  if (VI_MARK_RE.test(body.slice(0, 120))) {
    return { ok: false, reason: 'unexpected_vi', head };
  }
  if (!/[A-Za-z]{3,}/.test(body)) {
    return { ok: false, reason: 'missing_en', head };
  }
  return { ok: true, head };
}

/**
 * Anthropic assistant prefill — open with content in the answer language
 * so the model continues the article instead of English/VI planning.
 */
export function cbetaAnswerPrefill(
  lang: CbetaAnswerLang,
  coverageList: boolean,
): string {
  if (lang === 'zh') {
    return coverageList
      ? '第一部分\n\n以下依已掃範圍列出祖師：\n\n'
      : '第一部分\n\n禪（定慧之學）在本段 CBETA 語境中，';
  }
  if (lang === 'en') {
    return coverageList
      ? 'PART 1\n\nPatriarchs in the scanned scope:\n\n'
      : 'PART 1\n\nChan (禪), according to the CBETA passages below, ';
  }
  return coverageList
    ? 'PHẦN 1\n\nDưới đây là các vị tổ trong phạm vi đã quét:\n\n'
    : 'PHẦN 1\n\nThiền (禪), theo ngữ cảnh CBETA dưới đây, ';
}
