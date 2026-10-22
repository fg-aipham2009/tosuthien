/**
 * Quality suite for CBETA chat on demo.tosuthien.net.
 * Broader than smoke: completeness, lang, anti-junk, routing, brief vs full.
 *
 *   npx tsx scripts/quality-cbeta-demo.ts
 *   CBETA_SMOKE_BASE=https://demo.tosuthien.net npx tsx scripts/quality-cbeta-demo.ts
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import {
  assertCbetaAnswerLang,
  stripCbetaAnswerPrefill,
  stripLeadingMetaPlanning,
} from '../src/rag/cbeta/cbeta-answer-quality.util';
import type { CbetaAnswerLang } from '../src/rag/cbeta/cbeta-intent.util';

const BASE = process.env.CBETA_SMOKE_BASE || 'https://demo.tosuthien.net';
const API = `${BASE.replace(/\/$/, '')}/api`;
const REPORT =
  process.env.CBETA_QUALITY_REPORT ||
  `/tmp/cbeta-quality-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

const VI_MARK =
  /[àáạảãăằắặẳẵâầấậẩẫèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

type CaseResult = {
  name: string;
  question: string;
  ok: boolean;
  ms: number;
  errors: string[];
  meta?: Record<string, unknown>;
  answerLen: number;
  head: string;
};

type QualityCase = {
  name: string;
  question: string;
  lang: CbetaAnswerLang;
  timeoutMs: number;
  expectPath?: 'fast' | 'deep';
  expectJingdeOnly?: boolean;
  expectXuChuandeng?: boolean;
  minAnswerChars?: number;
  maxAnswerChars?: number;
  mustMatch?: RegExp[];
  mustNotMatch?: RegExp[];
  /** Patriarch list: require Tây Thiên / Đông Độ blocks + min numbered rows. */
  patriarchCompleteness?: {
    minXitian?: number;
    minDongdu?: number;
    requireAppendixHint?: boolean;
  };
  brief?: boolean;
};

async function getJson(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body: body as Record<string, unknown> };
}

type SmokeEvent = {
  type: string;
  at: number;
  payload: Record<string, unknown>;
};

async function streamFull(
  question: string,
  timeoutMs: number,
  lang: CbetaAnswerLang,
): Promise<{ events: SmokeEvent[]; answer: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();
  const events: SmokeEvent[] = [];
  try {
    const res = await fetch(`${API}/cbeta/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ question }),
      signal: ac.signal,
    });
    assert.equal(res.ok, true, `stream HTTP ${res.status}`);
    assert.ok(res.body, 'stream body missing');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        let event = 'message';
        const dataLines: string[] = [];
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
        } catch {
          continue;
        }
        const type = String(payload.type || event);
        events.push({ type, at: Date.now() - t0, payload });
        if (type === 'error' || type === 'done') {
          clearTimeout(timer);
          await reader.cancel().catch(() => undefined);
          break;
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }

  const done = events.find((e) => e.type === 'done')?.payload as
    | { answer?: string; aiInterpretation?: string }
    | undefined;
  const deltaText = events
    .filter((e) => e.type === 'delta')
    .map((e) => String(e.payload.text || ''))
    .join('');
  const answer =
    [done?.answer, done?.aiInterpretation].filter(Boolean).join('\n\n') ||
    deltaText;
  // Touch lang so TS keeps import used when early-exit paths change.
  void lang;
  return { events, answer };
}

function countSectionRows(answer: string, sectionRe: RegExp): number {
  const m = answer.match(sectionRe);
  if (!m || m.index == null) return 0;
  const start = m.index + m[0].length;
  const rest = answer.slice(start);
  const next = rest.search(/\n[ABC]\.\s/);
  const block = next >= 0 ? rest.slice(0, next) : rest;
  return (block.match(/^\d+\.\s/gm) || []).length;
}

function evaluateCase(c: QualityCase, events: SmokeEvent[], answer: string) {
  const errors: string[] = [];
  const types = events.map((e) => e.type);
  if (!types.includes('status')) errors.push('missing status');
  if (!types.includes('delta') && !types.includes('done')) {
    errors.push(`no delta/done (${types.join(',')})`);
  }
  if (types.includes('error')) {
    const err = events.find((e) => e.type === 'error');
    errors.push(`stream error: ${err?.payload?.message || ''}`);
  }

  const meta = events.find((e) => e.type === 'meta')?.payload?.meta as
    | Record<string, unknown>
    | undefined;

  if (c.expectPath && meta?.path && meta.path !== c.expectPath) {
    errors.push(`path=${meta.path} expected ${c.expectPath}`);
  }
  if (c.expectJingdeOnly && meta) {
    const works = (meta.worksScanned as string[]) || [];
    if (!works.some((w) => String(w).includes('2076'))) {
      errors.push(`expected Jingde T51n2076, got ${JSON.stringify(works)}`);
    }
    if (works.length !== 1 || !String(works[0]).includes('2076')) {
      errors.push(`expected Jingde-only scan, got ${JSON.stringify(works)}`);
    }
  }
  if (c.expectXuChuandeng && meta) {
    const works = (meta.worksScanned as string[]) || [];
    if (!works.some((w) => /2077|續/.test(String(w)))) {
      // work codes for 續傳燈 include T51n2077
      if (!works.some((w) => String(w).includes('2077'))) {
        errors.push(`expected 續傳燈 work, got ${JSON.stringify(works)}`);
      }
    }
  }

  const min = c.minAnswerChars ?? 80;
  if (answer.length < min) {
    errors.push(`answer too short (${answer.length} < ${min})`);
  }
  if (c.maxAnswerChars != null && answer.length > c.maxAnswerChars) {
    errors.push(`answer too long for brief (${answer.length} > ${c.maxAnswerChars})`);
  }

  const cleaned = stripLeadingMetaPlanning(
    stripCbetaAnswerPrefill(answer),
    c.lang,
  );
  const head = cleaned.slice(0, 320);
  if (/^(I'm |I'll |I need to|I should |Let me |First,\s|Tôi cần|Tôi sẽ)/i.test(head)) {
    errors.push('CoT opener still visible');
  }

  for (const re of c.mustMatch || []) {
    if (!re.test(answer)) errors.push(`mustMatch failed: ${re}`);
  }
  for (const re of c.mustNotMatch || []) {
    if (re.test(answer)) errors.push(`mustNotMatch hit: ${re}`);
  }

  // Bare-Hán numbered rows are never OK for VI/EN localized answers.
  if (c.lang !== 'zh' && /^\d+\.\s*[\u4e00-\u9fff]+$/m.test(answer)) {
    errors.push('bare-Hán numbered row in localized answer');
  }
  if (/còn \d+ tên|尚有 \d+ 名|\d+ more by frequency/i.test(answer)) {
    errors.push('mid-list truncation note present (list should be full)');
  }

  if (c.patriarchCompleteness) {
    const pc = c.patriarchCompleteness;
    const xitian = countSectionRows(
      answer,
      /A\.\s*(Tây Thiên|Western lineage|西天)/i,
    );
    const dongdu = countSectionRows(
      answer,
      /B\.\s*(Đông Độ|Eastern|東土)/i,
    );
    if (pc.minXitian != null && xitian < pc.minXitian) {
      errors.push(`Tây Thiên rows ${xitian} < ${pc.minXitian}`);
    }
    if (pc.minDongdu != null && dongdu < pc.minDongdu) {
      errors.push(`Đông Độ rows ${dongdu} < ${pc.minDongdu}`);
    }
    if (pc.requireAppendixHint && !/Phụ lục|Other names|其他名號/i.test(answer)) {
      // Appendix may be empty if no localized non-lineage names — only warn via soft check for VI.
      if (c.lang === 'vi' && answer.length < 3000) {
        errors.push('VI patriarch list looks thin (no appendix / short body)');
      }
    }
  }

  if (c.lang === 'en') {
    // Ignore CJK parentheses + accidental "Hán" scholarly token; flag real VI prose.
    const enProbe = answer
      .slice(0, 900)
      .replace(/\([^)]*[\u4e00-\u9fff][^)]*\)/g, '')
      .replace(/\bHán\b/gi, 'Han');
    if (VI_MARK.test(enProbe)) {
      errors.push('Vietnamese diacritics in EN head');
    }
  }

  const gate = assertCbetaAnswerLang(answer, c.lang === 'zh' ? 'zh' : c.lang);
  if (!gate.ok) {
    errors.push(`lang gate: ${gate.reason}`);
  }

  // Non-brief conceptual answers should have two-part structure or substantive body.
  if (!c.brief && c.expectPath === 'fast') {
    const hasParts =
      /PHẦN\s*1|PART\s*1|第一部分|【AI|AI diễn giải|AI interpretation/i.test(
        answer,
      );
    if (!hasParts && answer.length < 400) {
      errors.push('conceptual answer missing PHẦN/PART structure and too short');
    }
  }

  return { errors, meta, head };
}

const CASES: QualityCase[] = [
  {
    name: 'vi-patriarch-jingde',
    question: 'Liệt kê các vị tổ trong truyền đăng lục',
    lang: 'vi',
    timeoutMs: 120_000,
    expectPath: 'deep',
    expectJingdeOnly: true,
    minAnswerChars: 2000,
    mustMatch: [
      /Tây Thiên/,
      /Đông Độ/,
      /Ma-ha Ca-diếp|Ca-diếp/,
      /Bồ-đề Đạt-ma|Đạt-ma/,
      /Huệ Năng/,
      /Huệ Khả/,
    ],
    mustNotMatch: [/1\.\s*諸佛/, /1\.\s*比丘/, /問如何是/, /東域傳燈目錄/],
    patriarchCompleteness: {
      minXitian: 20,
      minDongdu: 5,
      requireAppendixHint: true,
    },
  },
  {
    name: 'vi-patriarch-theo-truyen-dang',
    question: 'Kể tên các tổ sư Thiền theo truyền đăng',
    lang: 'vi',
    timeoutMs: 120_000,
    expectPath: 'deep',
    expectJingdeOnly: true,
    minAnswerChars: 2000,
    mustMatch: [/Tây Thiên/, /Đông Độ/, /Huệ Năng|Đạt-ma|Ca-diếp/],
    mustNotMatch: [/東域傳燈目錄/, /日本佛教/],
    patriarchCompleteness: { minXitian: 20, minDongdu: 5 },
  },
  {
    name: 'vi-patriarch-ngu-dang',
    question: 'Liệt kê tổ sư trong Ngũ Đăng Hội Nguyên',
    lang: 'vi',
    timeoutMs: 180_000,
    expectPath: 'deep',
    minAnswerChars: 200,
    mustMatch: [/tên|Tây Thiên|Đông Độ|Phụ lục|Ngũ|五燈|phạm vi/i],
  },
  {
    name: 'vi-tuc-truyen-dang',
    question: 'Liệt kê tổ trong tục truyền đăng lục',
    lang: 'vi',
    timeoutMs: 180_000,
    expectPath: 'deep',
    expectXuChuandeng: true,
    minAnswerChars: 200,
    mustMatch: [/phạm vi|tên|Phụ lục|Tây Thiên|Đông Độ/i],
  },
  {
    name: 'en-patriarch-lamp',
    question: 'List the Chan patriarchs in the Transmission of the Lamp',
    lang: 'en',
    timeoutMs: 120_000,
    expectPath: 'deep',
    expectJingdeOnly: true,
    minAnswerChars: 3000,
    mustMatch: [
      /Bodhidharma|Mahākāśyapa|Mahakasyapa/i,
      /Huineng|Huike/i,
      /Other names|appendix|C\./i,
    ],
    patriarchCompleteness: {
      minXitian: 20,
      minDongdu: 5,
      requireAppendixHint: true,
    },
  },
  {
    name: 'zh-patriarch',
    question: '列出景德傳燈錄西天東土祖師',
    lang: 'zh',
    timeoutMs: 120_000,
    expectPath: 'deep',
    expectJingdeOnly: true,
    minAnswerChars: 400,
    mustMatch: [/西天/, /東土/, /迦葉|摩訶迦葉/, /慧能/],
    patriarchCompleteness: { minXitian: 20, minDongdu: 5 },
  },
  {
    name: 'vi-thien-la-gi',
    question: 'thiền là gì',
    lang: 'vi',
    timeoutMs: 120_000,
    expectPath: 'fast',
    minAnswerChars: 350,
    mustMatch: [/Thiền|thiền|禪/],
    mustNotMatch: [/I'm |I'll |I need to/i],
  },
  {
    name: 'vi-thien-tom-gon',
    question: 'Tóm gọn: thiền là gì?',
    lang: 'vi',
    timeoutMs: 90_000,
    expectPath: 'fast',
    brief: true,
    minAnswerChars: 120,
    maxAnswerChars: 4500,
    mustMatch: [/Thiền|thiền|禪/],
  },
  {
    name: 'vi-bodhidharma',
    question: 'Bồ-đề Đạt-ma là ai theo CBETA?',
    lang: 'vi',
    timeoutMs: 240_000,
    expectPath: 'fast',
    minAnswerChars: 300,
    mustMatch: [/Đạt-ma|達磨|達摩|Bồ-đề/i],
  },
  {
    name: 'vi-huenang',
    question: 'Huệ Năng có phải Lục Tổ không? Giải thích theo kinh điển CBETA.',
    lang: 'vi',
    timeoutMs: 240_000,
    expectPath: 'fast',
    minAnswerChars: 300,
    mustMatch: [/Huệ Năng|慧能|Lục Tổ|六祖/i],
  },
  {
    name: 'vi-zhao-zhou',
    question: 'Công án Triệu Châu ăn cháo chưa nói gì?',
    lang: 'vi',
    timeoutMs: 240_000,
    expectPath: 'fast',
    minAnswerChars: 250,
    mustMatch: [/Triệu Châu|趙州|cháo|喫茶|喫粥|công án|公案/i],
  },
  {
    name: 'en-what-is-chan',
    question: 'What is Chan according to CBETA sources?',
    lang: 'en',
    timeoutMs: 180_000,
    expectPath: 'fast',
    minAnswerChars: 300,
    mustMatch: [/Chan|Dhyāna|Dhyana|禪/i],
  },
  {
    name: 'en-brief-chan',
    question: 'Briefly: what is Chan?',
    lang: 'en',
    timeoutMs: 90_000,
    expectPath: 'fast',
    brief: true,
    minAnswerChars: 80,
    maxAnswerChars: 4000,
    mustMatch: [/Chan|Dhyāna|Dhyana|禪/i],
  },
  {
    name: 'vi-citation-work',
    question: 'Trong T51n2076 nói gì về Tổ sư truyền pháp?',
    lang: 'vi',
    timeoutMs: 240_000,
    expectPath: 'fast',
    minAnswerChars: 200,
    mustMatch: [/T51n2076|傳燈|tổ|pháp|CBETA|Đạt-ma|Huệ/i],
  },
  {
    name: 'vi-platform-sutra',
    question: 'Tóm tắt ý chính của Đàn Kinh (Pháp Bảo Đàn Kinh) theo CBETA',
    lang: 'vi',
    timeoutMs: 180_000,
    expectPath: 'fast',
    minAnswerChars: 300,
    mustMatch: [/Đàn|壇經|Huệ Năng|慧能|kiến tính|見性/i],
  },
  {
    name: 'vi-linji',
    question: 'Lâm Tế Nghĩa Huyền dạy gì? Trả lời đầy đủ theo nguồn CBETA.',
    lang: 'vi',
    timeoutMs: 240_000,
    expectPath: 'fast',
    minAnswerChars: 300,
    mustMatch: [/Lâm Tế|臨濟|Nghĩa Huyền|義玄/i],
  },
  // --- extra cases (edge / FE-like / mixed script) ---
  {
    name: 'vi-mixed-huineng',
    question: 'Huệ Năng (慧能) “kiến tính thành Phật” nghĩa là gì theo CBETA?',
    lang: 'vi',
    timeoutMs: 240_000,
    expectPath: 'fast',
    minAnswerChars: 300,
    mustMatch: [/Huệ Năng|慧能|kiến tính|見性|thành Phật|成佛/i],
  },
  {
    name: 'vi-bulap-vantu',
    question: '“Không lập văn tự” trong Thiền tông nghĩa là gì?',
    lang: 'vi',
    timeoutMs: 180_000,
    expectPath: 'fast',
    minAnswerChars: 250,
    mustMatch: [/văn tự|文字|bất lập|不立|Thiền|禪/i],
  },
  {
    name: 'vi-xuyun',
    question: '虛雲和尚如何參禪？ Trả lời bằng tiếng Việt, đầy đủ.',
    lang: 'vi',
    timeoutMs: 240_000,
    minAnswerChars: 250,
    mustMatch: [/Hư Vân|虛雲|tham thiền|參禪|Thiền|禪/i],
  },
  {
    name: 'vi-laiguo',
    question: '來果禪師禪七開示要旨 là gì? Giải thích tiếng Việt.',
    lang: 'vi',
    timeoutMs: 240_000,
    minAnswerChars: 200,
    mustMatch: [/Lai Quả|來果|thiền thất|禪七|khai thị|開示|Thiền|禪/i],
  },
  {
    name: 'vi-long-diacritics',
    question:
      'Bồ-đề Đạt-ma từ Thiên Trúc sang Đông Độ truyền pháp như thế nào theo CBETA?',
    lang: 'vi',
    timeoutMs: 240_000,
    expectPath: 'fast',
    minAnswerChars: 300,
    mustMatch: [/Đạt-ma|達磨|達摩|Thiên Trúc|Đông Độ|truyền/i],
  },
  {
    name: 'vi-fe-truncated-typo',
    // Simulates FE IME “thiếu chữ”: user meant “thiền là gì” but sent truncated.
    question: 'thin là gì',
    lang: 'vi',
    timeoutMs: 180_000,
    expectPath: 'fast',
    minAnswerChars: 80,
    // Should still answer something useful (thiền / thin / clarify), not crash.
    mustMatch: [/Thiền|thiền|禪|thin|không rõ|ý hỏi/i],
  },
  {
    name: 'zh-what-is-chan',
    question: '何謂禪？請依 CBETA 說明',
    lang: 'zh',
    timeoutMs: 180_000,
    expectPath: 'fast',
    minAnswerChars: 200,
    mustMatch: [/禪/],
  },
  {
    name: 'en-huineng',
    question: 'Who was Huineng according to CBETA, and why is he the Sixth Patriarch?',
    lang: 'en',
    timeoutMs: 240_000,
    expectPath: 'fast',
    minAnswerChars: 300,
    mustMatch: [/Huineng|Sixth|patriarch|慧能|Platform|坛经|壇經/i],
  },
];

async function main() {
  console.log(`quality base=${API}`);
  const health = await getJson('/cbeta/health');
  assert.equal(health.status, 200);
  assert.equal(health.body?.ok, true);
  console.log('OK health', {
    works: health.body.works,
    chunks: health.body.chunks,
    embeddings: health.body.embeddings,
  });

  const only = (process.env.CBETA_QUALITY_ONLY || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const selected = only.length
    ? CASES.filter((c) => only.includes(c.name))
    : CASES;
  if (!selected.length) {
    throw new Error(`CBETA_QUALITY_ONLY matched no cases: ${only.join(',')}`);
  }

  const results: CaseResult[] = [];
  for (const c of selected) {
    const t0 = Date.now();
    process.stdout.write(`→ ${c.name} … `);
    try {
      const { events, answer } = await streamFull(
        c.question,
        c.timeoutMs,
        c.lang,
      );
      const { errors, meta, head } = evaluateCase(c, events, answer);
      const ms = Date.now() - t0;
      const ok = errors.length === 0;
      results.push({
        name: c.name,
        question: c.question,
        ok,
        ms,
        errors,
        meta,
        answerLen: answer.length,
        head,
      });
      console.log(
        ok
          ? `OK ${ms}ms len=${answer.length}`
          : `FAIL ${ms}ms len=${answer.length} :: ${errors.join(' | ')}`,
      );
    } catch (err) {
      const ms = Date.now() - t0;
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        name: c.name,
        question: c.question,
        ok: false,
        ms,
        errors: [msg],
        answerLen: 0,
        head: '',
      });
      console.log(`FAIL ${ms}ms :: ${msg}`);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const report = {
    base: API,
    at: new Date().toISOString(),
    summary: { total: results.length, passed, failed: failed.length },
    results,
  };
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(`\nREPORT ${REPORT}`);
  console.log(`SUMMARY ${passed}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILURES:');
    for (const f of failed) {
      console.log(` - ${f.name}: ${f.errors.join(' | ')}`);
    }
    process.exit(1);
  }
  console.log('ALL QUALITY PASSED');
}

main().catch((err) => {
  console.error('QUALITY FAILED', err);
  process.exit(1);
});
