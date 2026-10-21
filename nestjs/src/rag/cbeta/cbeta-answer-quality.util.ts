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

const EN_PLAN_OPENER_RE =
  /^(I'm |I'll |I |Next I'm |a synthesis|an? ["']?AI|then an? |distinguishing doctrinal|Note that|English answer|English[, ]|English\b|first\s+a\s+synthesis|First,\s|pulling together)/i;

const EN_PLAN_INLINE_RE =
  /\b(synthesis section|AI interpretation|two[- ]part|structure my answer|drawing together|pulling together the etymology|without citations)\b/i;

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
      .replace(/^Người dùng hỏi[^.\n]*?[.:：]\s*/i, '')
      .replace(/^I (?:need to|also want to|want to|am going to|will)[\s\S]{0,500}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^I'm (?:noting|starting|outlining|looking|thinking|going)[\s\S]{0,500}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^I'll[\s\S]{0,500}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^Next I'm[\s\S]{0,400}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^Let me[\s\S]{0,400}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^Looking at[\s\S]{0,400}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^First,\s+[\s\S]{0,400}?(?:—|–|:|\.\s+)/i, '')
      .replace(/^First (?:I|I'll|I'm|let|we|a)\b[\s\S]{0,400}?(?:—|–|:|\.\s+)/i, '');
    if (next === t) break;
    t = next;
  }
  t = t.replace(/^\s+/, '');
  if (lang === 'en') {
    for (let i = 0; i < 8; i++) {
      const lead = t.slice(0, 160);
      const isPlan =
        EN_PLAN_OPENER_RE.test(t) || EN_PLAN_INLINE_RE.test(lead);
      if (!isPlan && !VI_MARK_RE.test(lead)) break;
      const cue = t.search(
        /\b(?:Chan means|Chan is|Chan—|Dhyāna|Dhyana|Zen means|According to CBETA|In the CBETA)\b/,
      );
      if (cue > 0 && cue < 800) {
        t = t.slice(cue).replace(/^\s+/, '');
        continue;
      }
      const cut = t.search(/[.?!]\s+/);
      if (cut >= 0 && cut <= 600) {
        t = t.slice(cut + 1).replace(/^\s+/, '');
        continue;
      }
      const viaColon = t.replace(
        /^(?:I(?:'ll|'m| should| also| want| need)|a synthesis|then an?|Note that|English(?: answer)?|first\s+(?:a\s+)?synthesis)[\s\S]{0,500}?(?:—|–|:|\.\s+)/i,
        '',
      );
      if (viaColon !== t) {
        t = viaColon.replace(/^\s+/, '');
        continue;
      }
      if (VI_MARK_RE.test(lead) || isPlan) {
        const next = t.replace(/^[\s\S]{0,360}?(?=[A-Z][a-z]{2,})/, '');
        if (next === t || !next) break;
        t = next.replace(/^\s+/, '');
        continue;
      }
      break;
    }
    t = t
      .replace(/\bGiáo môn\b/g, 'doctrinal school')
      .replace(/\bTổ [Ss]ư [Tt]hiền\b/g, 'patriarch Chan')
      .replace(/\bTổ sư thiền\b/gi, 'patriarch Chan');
  }
  if (lang === 'vi') {
    for (let i = 0; i < 6; i++) {
      if (!t) break;
      const leadPlain = t.slice(0, 80).replace(/\([^)]*\)/g, '');
      const enLead =
        /^(I'm |I'll |I |The |A |An |This |That |In the |According to|Looking |Based on|Here |Note that|Người dùng hỏi)/i.test(
          t,
        ) ||
        (/^(the|a|an|this|that|in|according|looking|based|here|note)\b/i.test(
          t,
        ) &&
          !VI_MARK_RE.test(leadPlain));
      if (!enLead) break;
      const cue = t.search(
        /(?:^|[.?!。]\s+)(?=Thiền\s*\(|Theo |Trong |Định nghĩa|Các tên|Dưới đây|là |giải thích)/,
      );
      if (cue >= 0 && cue < 700) {
        t = t.slice(cue).replace(/^[.?!。]\s+/, '').replace(/^\s+/, '');
        continue;
      }
      const cut = t.search(/[.?!。]\s+/);
      if (cut >= 0 && cut <= 500) {
        t = t.slice(cut + 1).replace(/^\s+/, '');
        continue;
      }
      break;
    }
  }
  return t;
}

/**
 * Keep buffering the stream head until language gate would pass,
 * or the buffer hits a soft ceiling (then flush best-effort cleaned text).
 */
export function shouldBufferCbetaHead(
  headBuf: string,
  lang: CbetaAnswerLang,
  coverageList = false,
): boolean {
  if (headBuf.length < 48) return true;
  const sample = cbetaAnswerPrefill(lang, coverageList) + headBuf;
  const gate = assertCbetaAnswerLang(sample, lang);
  if (gate.ok) return false;
  // Soft ceiling — avoid holding forever on a stuck CoT model.
  const ceiling = lang === 'en' ? 1100 : 900;
  return headBuf.length < ceiling;
}

/**
 * True when the answer opens with LLM meta / planning instead of content.
 */
export function isMetaPlanningOpener(text: string): boolean {
  const head = stripCbetaAnswerPrefill(text).slice(0, 200);
  if (!head) return false;
  if (EN_PLAN_OPENER_RE.test(head)) return true;
  if (EN_PLAN_INLINE_RE.test(head.slice(0, 180))) return true;
  if (
    /^(The (question|context|entity|user|answer|passage|list)\b|I['’ ]|I'm |I'll |I am |Here |According to|In the |This question|Looking |Based on|Note that|Let me)/i.test(
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
  if (
    /^(Tôi cần|Tôi sẽ|Tôi đang|Mình cần|Để trả lời|Trả lời bằng tiếng|Người dùng hỏi)/i.test(
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
 */
export function assertCbetaAnswerLang(
  text: string,
  lang: CbetaAnswerLang,
): AssertCbetaAnswerLangResult {
  const strippedPrefill = stripCbetaAnswerPrefill(text);
  const body = stripLeadingMetaPlanning(strippedPrefill, lang);
  const head = body.slice(0, 160);
  if (body.length < 20) {
    return { ok: false, reason: 'too_short', head };
  }
  if (isMetaPlanningOpener(body)) {
    return { ok: false, reason: 'meta_planning', head };
  }
  if (lang === 'vi') {
    const leadPlain = body.slice(0, 120).replace(/\([^)]*\)/g, '');
    if (!VI_MARK_RE.test(leadPlain)) {
      return { ok: false, reason: 'missing_vi_marks', head };
    }
    if (
      /^(the|a|an|this|that|in|according|looking|based|here|note|I\b|I'm|I'll)\b/i.test(
        body.trim(),
      )
    ) {
      return { ok: false, reason: 'en_lead_in_vi', head };
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
  if (VI_MARK_RE.test(body.slice(0, 120))) {
    return { ok: false, reason: 'unexpected_vi', head };
  }
  if (!/[A-Za-z]{3,}/.test(body)) {
    return { ok: false, reason: 'missing_en', head };
  }
  if (EN_PLAN_OPENER_RE.test(body.trim())) {
    return { ok: false, reason: 'meta_planning', head };
  }
  return { ok: true, head };
}

/** Sanitize a full assembled answer for one-shot emit / retry decision. */
export function sanitizeCbetaAnswer(
  text: string,
  lang: CbetaAnswerLang,
): { text: string; gate: AssertCbetaAnswerLangResult } {
  const strippedPrefill = stripCbetaAnswerPrefill(text);
  const body = stripLeadingMetaPlanning(strippedPrefill, lang);
  // Re-attach a minimal heading so UI still has PHẦN/PART structure when body is OK.
  const prefill = text.match(/^(PHẦN\s*1|PART\s*1|第一部分)/i)?.[0];
  const rebuilt = prefill ? `${prefill}\n\n${body}` : body;
  const gate = assertCbetaAnswerLang(
    prefill
      ? `${prefill}\n\n${cbetaAnswerPrefillBodyCue(lang)}${body}`
      : cbetaAnswerPrefill(lang, false) + body,
    lang,
  );
  return { text: rebuilt, gate };
}

function cbetaAnswerPrefillBodyCue(lang: CbetaAnswerLang): string {
  if (lang === 'zh') return '禪（定慧之學）在本段 CBETA 語境中，';
  if (lang === 'en') return 'Chan (禪), according to the CBETA passages below, ';
  return 'Thiền (禪), theo ngữ cảnh CBETA dưới đây, ';
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
