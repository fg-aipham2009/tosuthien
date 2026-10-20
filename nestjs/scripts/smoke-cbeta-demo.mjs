#!/usr/bin/env node
/**
 * Smoke-test CBETA chat on demo.tosuthien.net.
 * Exit 0 only if health + route + stream reach generating/delta within budgets.
 */
import assert from 'node:assert/strict';

const BASE = process.env.CBETA_SMOKE_BASE || 'https://demo.tosuthien.net';
const API = `${BASE.replace(/\/$/, '')}/api`;

async function getJson(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function streamEvents(question, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();
  const events = [];
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
      let sep;
      while ((sep = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        let event = 'message';
        const dataLines = [];
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let payload = {};
        try {
          payload = JSON.parse(dataLines.join('\n'));
        } catch {
          continue;
        }
        const type = payload.type || event;
        events.push({ type, at: Date.now() - t0, payload });
        const deltaChars = events
          .filter((e) => e.type === 'delta')
          .reduce((n, e) => n + String(e.payload.text || '').length, 0);
        // Collect enough answer text to judge language (first token is not enough).
        if (
          type === 'error' ||
          type === 'done' ||
          (type === 'delta' && deltaChars >= 120)
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

function summarize(events) {
  return events.map((e) => {
    if (e.type === 'status') {
      return `status:${e.payload.phase || ''} ${(e.payload.message || '').slice(0, 60)}`;
    }
    if (e.type === 'meta') {
      const m = e.payload.meta || {};
      return `meta path=${m.path} hits=${m.hitCount} entities=${m.entityCount} works=${JSON.stringify(m.worksScanned)} ms=${m.retrievalMs}`;
    }
    if (e.type === 'delta') return `delta:${String(e.payload.text || '').slice(0, 40)}`;
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
    rewriteMs: route.body.queryRewrite?.rewriteMs,
  });

  const cases = [
    {
      name: 'vi-patriarch-list',
      question: routeQ,
      timeoutMs: 90_000,
      expectViDelta: true,
    },
    {
      name: 'vi-simple',
      question: 'thiền là gì',
      timeoutMs: 90_000,
      expectViDelta: true,
    },
    {
      name: 'en-simple',
      question: 'What is Chan?',
      timeoutMs: 90_000,
      expectViDelta: false,
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

    const meta = events.find((e) => e.type === 'meta')?.payload?.meta;
    if (c.name === 'vi-patriarch-list' && meta) {
      assert.equal(meta.path, 'deep');
      assert.ok(
        Array.isArray(meta.worksScanned) &&
          meta.worksScanned.some((w) => String(w).includes('2076')),
        `expected Jingde work T51n2076 in worksScanned, got ${JSON.stringify(meta.worksScanned)}`,
      );
      assert.ok(
        (meta.retrievalMs ?? 0) < 60_000,
        `retrieval too slow: ${meta.retrievalMs}ms`,
      );
    }

    const deltaText = events
      .filter((e) => e.type === 'delta')
      .map((e) => e.payload.text || '')
      .join('');
    if (c.expectViDelta) {
      assert.ok(
        deltaText.length >= 40,
        `${c.name}: too little answer text (${deltaText.length})`,
      );
      // Ignore known Vietnamese prefills when judging language of model tokens.
      const body = deltaText
        .replace(/^PHẦN\s*1\s*/i, '')
        .replace(
          /^Dưới đây là các vị tổ trong phạm vi đã quét:\s*/i,
          '',
        )
        .trim();
      const head = body.slice(0, 160);
      // Require real Vietnamese diacritics — bare "Tổ" inside English prose must not pass.
      const hasViMarks =
        /[àáạảãăằắặẳẵâầấậẩẫèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
          body,
        );
      const mostlyEnEarly =
        /^(The |I['’ ]|I'm |I am |Here |According |In the |This |Looking |Based |Note |Let me|First )/i.test(
          head,
        ) ||
        /\b(I'm noting|I need to|entity list|noisy and full|context block|unrelated)\b/i.test(
          head,
        );
      assert.ok(
        hasViMarks && !mostlyEnEarly,
        `${c.name}: expected Vietnamese answer, got head=${JSON.stringify(head)}`,
      );
    }
    console.log(`OK ${c.name}`);
  }

  console.log('ALL SMOKE PASSED');
}

main().catch((err) => {
  console.error('SMOKE FAILED', err);
  process.exit(1);
});
