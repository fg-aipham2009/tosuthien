/**
 * Smoke-test CBETA chat on demo.tosuthien.net.
 * Exit 0 only if health + route + stream reach generating/delta within budgets.
 */
import assert from 'node:assert/strict';
import { assertCbetaAnswerLang } from '../src/rag/cbeta/cbeta-answer-quality.util';

const BASE = process.env.CBETA_SMOKE_BASE || 'https://demo.tosuthien.net';
const API = `${BASE.replace(/\/$/, '')}/api`;

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

async function streamEvents(
  question: string,
  timeoutMs: number,
): Promise<SmokeEvent[]> {
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
        const deltaChars = events
          .filter((e) => e.type === 'delta')
          .reduce((n, e) => n + String(e.payload.text || '').length, 0);
        if (
          type === 'error' ||
          type === 'done' ||
          (type === 'delta' && deltaChars >= 160)
        ) {
          clearTimeout(timer);
          await reader.cancel().catch(() => undefined);
          return events;
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return events;
}

function summarize(events: SmokeEvent[]) {
  return events.map((e) => {
    if (e.type === 'status') {
      return `status:${e.payload.phase || ''} ${String(e.payload.message || '').slice(0, 60)}`;
    }
    if (e.type === 'meta') {
      const m = (e.payload.meta || {}) as Record<string, unknown>;
      return `meta path=${m.path} hits=${m.hitCount} entities=${m.entityCount} works=${JSON.stringify(m.worksScanned)} ms=${m.retrievalMs}`;
    }
    if (e.type === 'delta')
      return `delta:${String(e.payload.text || '').slice(0, 40)}`;
    if (e.type === 'error') return `error:${e.payload.message || ''}`;
    return e.type;
  });
}

async function main() {
  console.log(`smoke base=${API}`);

  const health = await getJson('/cbeta/health');
  assert.equal(health.status, 200, 'health status');
  assert.equal(health.body?.ok, true, 'health ok');
  console.log('OK health', {
    works: health.body.works,
    chunks: health.body.chunks,
    embeddings: health.body.embeddings,
  });

  const routeQ = 'Liệt kê các vị tổ trong truyền đăng lục';
  const route = await getJson('/cbeta/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: routeQ }),
  });
  assert.equal(route.status, 200, 'route status');
  assert.equal(route.body.path, 'deep', 'route path deep');
  assert.equal(route.body.coverageMode, true, 'route coverageMode');
  console.log('OK route', {
    path: route.body.path,
    coverageMode: route.body.coverageMode,
    rewriteMs: (route.body.queryRewrite as { rewriteMs?: number } | undefined)
      ?.rewriteMs,
  });

  const cases: Array<{
    name: string;
    question: string;
    timeoutMs: number;
    lang: 'vi' | 'en';
  }> = [
    {
      name: 'vi-patriarch-list',
      question: routeQ,
      timeoutMs: 90_000,
      lang: 'vi',
    },
    {
      name: 'vi-simple',
      question: 'thiền là gì',
      timeoutMs: 90_000,
      lang: 'vi',
    },
    {
      name: 'en-simple',
      question: 'What is Chan?',
      timeoutMs: 90_000,
      lang: 'en',
    },
  ];

  for (const c of cases) {
    const t0 = Date.now();
    const events = await streamEvents(c.question, c.timeoutMs);
    const types = events.map((e) => e.type);
    console.log(`--- ${c.name} (${Date.now() - t0}ms) ---`);
    console.log(summarize(events).join('\n'));

    assert.ok(types.includes('status'), `${c.name}: missing status`);
    assert.ok(
      types.includes('delta') || types.includes('done'),
      `${c.name}: no delta/done — got ${types.join(',')}`,
    );
    assert.ok(!types.includes('error'), `${c.name}: stream error`);

    const meta = events.find((e) => e.type === 'meta')?.payload
      ?.meta as Record<string, unknown> | undefined;
    if (c.name === 'vi-patriarch-list' && meta) {
      assert.equal(meta.path, 'deep');
      assert.ok(
        Array.isArray(meta.worksScanned) &&
          meta.worksScanned.some((w) => String(w).includes('2076')),
        `expected Jingde work T51n2076 in worksScanned, got ${JSON.stringify(meta.worksScanned)}`,
      );
      assert.ok(
        (Number(meta.retrievalMs) || 0) < 60_000,
        `retrieval too slow: ${meta.retrievalMs}ms`,
      );
      // Quality: filtered deterministic list — no stop-name lead, has structure.
      const deltaText = events
        .filter((e) => e.type === 'delta')
        .map((e) => String(e.payload.text || ''))
        .join('');
      assert.doesNotMatch(deltaText.slice(0, 400), /1\. 諸佛/);
      assert.doesNotMatch(deltaText.slice(0, 400), /1\. 比丘/);
      assert.match(
        deltaText,
        /Tây Thiên|Đông Độ|Phụ lục|Các tên trong phạm vi/,
      );
    }

    const deltaText = events
      .filter((e) => e.type === 'delta')
      .map((e) => String(e.payload.text || ''))
      .join('');
    assert.ok(
      deltaText.length >= 40,
      `${c.name}: too little answer text (${deltaText.length})`,
    );
    const gate = assertCbetaAnswerLang(deltaText, c.lang);
    assert.ok(
      gate.ok,
      `${c.name}: lang quality failed (${gate.reason}), head=${JSON.stringify(gate.head)}`,
    );
    console.log(`OK ${c.name}`);
  }

  console.log('ALL SMOKE PASSED');
}

main().catch((err) => {
  console.error('SMOKE FAILED', err);
  process.exit(1);
});
