import { AI_INTERPRETATION_MARKER } from '../rag.constants';
import {
  filterCoverageEntities,
  type CoverageEntity,
} from './cbeta-entity.util';
import { detectCbetaAnswerLang } from './cbeta-intent.util';
import { formatMasterDisplayName } from './cbeta-name-display.util';

/**
 * Canonical 西天二十八祖 forms as commonly listed in lamp chronologies.
 * Only emitted when the name actually appears in the scanned entity set.
 */
export const XITIAN_PATRIARCHS = [
  '摩訶迦葉',
  '迦葉',
  '阿難',
  '商那和修',
  '優波毱多',
  '提多迦',
  '彌遮迦',
  '婆須蜜',
  '佛陀難提',
  '伏馱蜜多',
  '脅尊者',
  '富那夜奢',
  '馬鳴',
  '迦毘摩羅',
  '龍樹',
  '迦那提婆',
  '羅睺羅多',
  '僧伽難提',
  '伽耶舍多',
  '鳩摩羅多',
  '闍夜多',
  '婆修盤頭',
  '摩拏羅',
  '鶴勒那',
  '師子',
  '婆舍斯多',
  '不如密多',
  '般若多羅',
  '菩提達磨',
] as const;

/** 東土六祖 — only when present in entities. */
export const DONGDU_PATRIARCHS = [
  '菩提達磨',
  '達磨',
  '慧可',
  '僧璨',
  '道信',
  '弘忍',
  '慧能',
] as const;

/**
 * Match canonical lineage form to an extracted entity (exact, suffix, or
 * shorter attested form). Prefer higher count, then longer nameZh.
 */
function findPresentEntity(
  canonical: string,
  entities: CoverageEntity[],
  byName: Map<string, CoverageEntity>,
): CoverageEntity | undefined {
  const exact = byName.get(canonical);
  if (exact) return exact;
  let best: CoverageEntity | undefined;
  for (const e of entities) {
    const n = e.nameZh;
    if (
      n === canonical ||
      n.endsWith(canonical) ||
      (canonical.endsWith(n) && n.length >= 2)
    ) {
      if (
        !best ||
        e.count > best.count ||
        (e.count === best.count && n.length > best.nameZh.length)
      ) {
        best = e;
      }
    }
  }
  return best;
}

function pickPresentInOrder(
  canonical: readonly string[],
  entities: CoverageEntity[],
  byName: Map<string, CoverageEntity>,
): CoverageEntity[] {
  const out: CoverageEntity[] = [];
  const seenExact = new Set<string>();
  const seenForms = new Set<string>();
  for (const name of canonical) {
    const hit = findPresentEntity(name, entities, byName);
    if (!hit) continue;
    if (seenExact.has(hit.nameZh) || seenForms.has(name)) continue;
    // Prefer longer form already listed (摩訶迦葉 ⊃ 迦葉) — do not emit both.
    if (
      [...seenForms].some(
        (s) => s !== name && (s.endsWith(name) || name.endsWith(s)),
      )
    ) {
      continue;
    }
    seenExact.add(hit.nameZh);
    seenForms.add(name);
    // Always show the canonical lineage form (Sino-Viet / EN maps keys).
    out.push({ ...hit, nameZh: name });
  }
  return out;
}

function appendLines(
  lines: string[],
  used: { n: number },
  maxChars: number,
  next: string[],
  remainingNote: string,
): void {
  for (let i = 0; i < next.length; i++) {
    const line = next[i];
    if (maxChars > 0 && used.n + 1 + line.length > maxChars) {
      const left = next.length - i;
      if (left > 0) lines.push(remainingNote.replace('{n}', String(left)));
      break;
    }
    lines.push(line);
    used.n += 1 + line.length;
  }
}

/**
 * Deterministic PHẦN 1+2 for coverage/list intents.
 * Prefers Tây Thiên / Đông Độ sections when those names exist in entities;
 * appends a filtered frequency appendix. Never invents names outside the set.
 */
export function formatCbetaCoverageListAnswer(
  question: string,
  entities: CoverageEntity[],
  worksScanned: string[],
  maxChars: number,
): string {
  const lang = detectCbetaAnswerLang(question);
  const works = worksScanned.join(', ') || '(—)';
  // Lineage can use single attestations; appendix needs stronger signal
  // (repeat mentions) so one-off dialogue fragments do not dump thousands of rows.
  const filtered = filterCoverageEntities(entities);
  const appendixPool = filterCoverageEntities(entities, { minCount: 2 });
  const byName = new Map(filtered.map((e) => [e.nameZh, e]));

  const xitian = pickPresentInOrder(XITIAN_PATRIARCHS, filtered, byName);
  const dongdu = pickPresentInOrder(DONGDU_PATRIARCHS, filtered, byName);
  const inLineage = new Set([
    ...xitian.map((e) => e.nameZh),
    ...dongdu.map((e) => e.nameZh),
    // Also hide short aliases that were folded into a canonical lineage row.
    ...XITIAN_PATRIARCHS.filter((n) => xitian.some((e) => e.nameZh === n || e.nameZh.endsWith(n) || n.endsWith(e.nameZh))),
    ...DONGDU_PATRIARCHS.filter((n) => dongdu.some((e) => e.nameZh === n || e.nameZh.endsWith(n) || n.endsWith(e.nameZh))),
  ]);
  const appendix = appendixPool.filter((e) => !inLineage.has(e.nameZh));

  const lines: string[] = [];
  const used = { n: 0 };

  const remVi = '… (còn {n} tên theo tần suất trong phạm vi)';
  const remZh = '…（尚有 {n} 名，按頻次）';
  const remEn = '… ({n} more by frequency in scope)';
  const rem =
    lang === 'zh' ? remZh : lang === 'en' ? remEn : remVi;

  const lineOf = (e: CoverageEntity, i: number) =>
    `${i + 1}. ${formatMasterDisplayName(e.nameZh, lang)}`;

  if (lang === 'zh') {
    if (xitian.length) {
      appendLines(
        lines,
        used,
        maxChars,
        ['A. 西天：', ...xitian.map(lineOf)],
        rem,
      );
    }
    if (dongdu.length) {
      appendLines(
        lines,
        used,
        maxChars,
        ['B. 東土：', ...dongdu.map(lineOf)],
        rem,
      );
    }
    if (appendix.length) {
      appendLines(
        lines,
        used,
        maxChars,
        ['C. 其他名號（按頻次）：', ...appendix.map(lineOf)],
        rem,
      );
    }
  } else if (lang === 'en') {
    if (xitian.length) {
      appendLines(
        lines,
        used,
        maxChars,
        ['A. Western lineage (西天):', ...xitian.map(lineOf)],
        rem,
      );
    }
    if (dongdu.length) {
      appendLines(
        lines,
        used,
        maxChars,
        ['B. Eastern / China lineage (東土):', ...dongdu.map(lineOf)],
        rem,
      );
    }
    if (appendix.length) {
      appendLines(
        lines,
        used,
        maxChars,
        ['C. Other names by frequency:', ...appendix.map(lineOf)],
        rem,
      );
    }
  } else {
    if (xitian.length) {
      appendLines(
        lines,
        used,
        maxChars,
        ['A. Tây Thiên (西天):', ...xitian.map(lineOf)],
        rem,
      );
    }
    if (dongdu.length) {
      appendLines(
        lines,
        used,
        maxChars,
        ['B. Đông Độ (東土):', ...dongdu.map(lineOf)],
        rem,
      );
    }
    if (appendix.length) {
      appendLines(
        lines,
        used,
        maxChars,
        ['C. Phụ lục tên khác (theo tần suất):', ...appendix.map(lineOf)],
        rem,
      );
    }
  }

  // Fallback: no lineage hits — plain filtered frequency list.
  if (!lines.length && filtered.length) {
    appendLines(
      lines,
      used,
      maxChars,
      filtered.map(lineOf),
      rem,
    );
  }

  const body = lines.join('\n');

  let part1: string;
  let part2: string;
  switch (lang) {
    case 'zh':
      part1 = `以下依已掃 work（${works}）整理名號（西天／東土僅列實體中確有者；其餘按頻次；非另編年譜）：\n\n${body}`;
      part2 =
        '名單由 CBETA 原文擷取後過濾常見虛名，可能仍含異名／殘片；請以原典卷次核對。';
      break;
    case 'en':
      part1 = `Names from scanned works (${works}). Western/Eastern lineage sections list only names attested in the extract; appendix is frequency-ranked (not a critical edition chart):\n\n${body}`;
      part2 =
        'Filtered from CBETA text; may still include variants or fragments — verify against the source juan.';
      break;
    default:
      part1 = `Các tên trong phạm vi đã quét (${works}). Mục Tây Thiên / Đông Độ chỉ gồm tên có trong trích xuất; phụ lục xếp theo tần suất (chưa phải niên phổ phê bình):\n\n${body}`;
      part2 =
        'Đã lọc các hư danh thường gặp; vẫn có thể lẫn dị danh / mảnh chữ — cần đối chiếu đúng quyển.';
  }
  return `${part1}\n\n${AI_INTERPRETATION_MARKER}\n${part2}`;
}
