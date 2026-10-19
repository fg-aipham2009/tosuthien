/**
 * Local checks: expand / stitch markers / citation parse / OpenCC.
 * Run: node scripts/test-cbeta-expand.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const expand = join(root, 'nestjs/src/rag/cbeta/cbeta-expand.util.ts');
const parse = join(root, 'nestjs/src/rag/cbeta/cbeta-query-parse.util.ts');
const opencc = join(root, 'nestjs/src/rag/cbeta/cbeta-opencc.util.ts');

const r = spawnSync(
  'npx',
  [
    '--yes',
    'tsx',
    '-e',
    `
import {
  CBETA_ANCHOR_EXPAND_HITS,
  cbetaExpandIndexRange,
  needsCbetaDialogueBackshift,
  stitchChunkParts,
} from ${JSON.stringify(expand)};
import { parseCbetaCitationHints, extractPreservedCjk } from ${JSON.stringify(parse)};
import { toTraditionalZh } from ${JSON.stringify(opencc)};

function assert(c, m) { if (!c) { console.error('FAIL', m); process.exit(1); } }

assert(CBETA_ANCHOR_EXPAND_HITS === 2, 'anchor=2');
assert(cbetaExpandIndexRange(15,'anchor').from===14 && cbetaExpandIndexRange(15,'anchor').to===17, '[-1,+2]');
assert(cbetaExpandIndexRange(15,'support').from===15 && cbetaExpandIndexRange(15,'support').to===15, 'support center-only');
assert(needsCbetaDialogueBackshift('師曰：不可思量。')===true, 'backshift');
assert(needsCbetaDialogueBackshift('僧問：如何是祖師西來意？')===false, 'no backshift');

const st = stitchChunkParts([
  { text: '天地玄黃。師曰不可思量。', marker: 'p0292c01' },
  { text: '師曰不可思量。庭前柏樹子。', marker: 'p0292c16' },
]);
assert(st.includes('【p0292c16】'), 'stitch marker');
assert((st.match(/師曰不可思量/g)||[]).length===1, 'stitch dedupe');
assert(st.includes('庭前柏樹子'), 'stitch tail');

const h = parseCbetaCitationHints('Trong T48n2005 quyển 2 trang 292 nói gì?');
assert(h.workCodes.includes('T48n2005'), 'work_code parse '+JSON.stringify(h));
assert(h.juanNo===2, 'juan parse');
assert(h.cbetaRefNeedle==='p0292', 'page→ref '+h.cbetaRefNeedle);

assert(extractPreservedCjk('Nghĩa của 應無所住 là gì?').includes('應無所住'), 'preserve CJK');
assert(toTraditionalZh('坐禅昏沉')==='坐禪昏沉', 'opencc s2t');

console.log(JSON.stringify({ ok: true, stitchSample: st, hints: h }, null, 2));
`,
  ],
  { cwd: root, encoding: 'utf8' },
);
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
process.exit(r.status ?? 1);
