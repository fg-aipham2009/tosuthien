/**
 * Local unit checks for CBETA expand Test 1–2 (no DB / no LLM).
 * Run: node scripts/test-cbeta-expand.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const utilPath = join(root, 'nestjs/src/rag/cbeta/cbeta-expand.util.ts');

// Compile util with esbuild-register / tsx if available; else transpile inline via sucrase-free strip.
const r = spawnSync(
  'npx',
  ['--yes', 'tsx', '-e', `
import {
  CBETA_ANCHOR_EXPAND_HITS,
  cbetaExpandIndexRange,
  needsCbetaDialogueBackshift,
  stitchChunkTexts,
} from ${JSON.stringify(utilPath)};

function assert(c, m) { if (!c) { console.error('FAIL', m); process.exit(1); } }

assert(CBETA_ANCHOR_EXPAND_HITS === 2, 'anchor count = 2');

const a15 = cbetaExpandIndexRange(15, 'anchor');
assert(a15.from === 14 && a15.to === 17, 'Test1 anchor [-1,+2] @15 → 14..17');

const a0 = cbetaExpandIndexRange(0, 'anchor');
assert(a0.from === 0 && a0.to === 2, 'anchor at chunk 0');

const s15 = cbetaExpandIndexRange(15, 'support');
assert(s15.from === 15 && s15.to === 16, 'support [0,+1]');

assert(needsCbetaDialogueBackshift('師曰：不可思量。') === true, 'Test2 師曰 → backshift');
assert(needsCbetaDialogueBackshift('佛言：如是如是。') === true, 'Test2 佛言 → backshift');
assert(needsCbetaDialogueBackshift('答曰：庭前柏樹子。') === true, 'Test2 答曰 → backshift');
assert(needsCbetaDialogueBackshift('僧問：如何是祖師西來意？師曰：庭前柏樹子。') === false, '僧問 no backshift');
assert(needsCbetaDialogueBackshift('問：如何是佛法？') === false, '問： no backshift');
assert(needsCbetaDialogueBackshift('爾時世尊告諸比丘。') === false, '爾時 no backshift');

const left = '天地玄黃宇宙洪荒。師曰不可思量。';
const right = '師曰不可思量。庭前柏樹子。';
const st = stitchChunkTexts([left, right]);
assert(st.includes('天地玄黃'), 'stitch keeps head');
assert(st.includes('庭前柏樹子'), 'stitch keeps tail');
assert((st.match(/師曰不可思量/g) || []).length === 1, 'stitch dedupes overlap');

const noOv = stitchChunkTexts(['甲乙丙', '丁戊己']);
assert(noOv.includes('甲乙丙') && noOv.includes('丁戊己'), 'stitch no-overlap concat');

console.log(JSON.stringify({
  ok: true,
  tests: [
    'anchor_-1_+2',
    'support_0_+1',
    'dialogue_backshift',
    'stitch_dedupe',
  ],
  stitchSample: st,
}, null, 2));
`],
  { cwd: root, encoding: 'utf8' },
);

process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
process.exit(r.status ?? 1);
