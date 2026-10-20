import { AI_INTERPRETATION_MARKER } from '../rag.constants';
import { detectCbetaAnswerLang } from './cbeta-intent.util';

/**
 * Deterministic PHẦN 1+2 for coverage/list intents.
 * Avoids LLM English chain-of-thought when the entity list is the answer spine.
 */
export function formatCbetaCoverageListAnswer(
  question: string,
  entities: Array<{ nameZh: string; count: number; works: string[] }>,
  worksScanned: string[],
  maxChars: number,
): string {
  const lang = detectCbetaAnswerLang(question);
  const works = worksScanned.join(', ') || '(—)';
  const lines: string[] = [];
  let used = 0;
  for (let i = 0; i < entities.length; i++) {
    const line = `${i + 1}. ${entities[i].nameZh}`;
    if (maxChars > 0 && used + 1 + line.length > maxChars) {
      const remaining = entities.length - i;
      if (lang === 'zh') lines.push(`…（尚有 ${remaining} 名，按頻次）`);
      else if (lang === 'en')
        lines.push(`… (${remaining} more by frequency in scope)`);
      else lines.push(`… (còn ${remaining} tên theo tần suất trong phạm vi)`);
      break;
    }
    lines.push(line);
    used += 1 + line.length;
  }
  const body = lines.join('\n');

  let part1: string;
  let part2: string;
  switch (lang) {
    case 'zh':
      part1 = `以下為已掃 work（${works}）原文中出現的名號（按頻次；非另編年譜）：\n\n${body}`;
      part2 =
        '名單由 CBETA 原文擷取彙總，可能含異名／殘片；請以原典卷次核對。';
      break;
    case 'en':
      part1 = `Names attested in scanned works (${works}), ordered by frequency (not a critical lineage chart):\n\n${body}`;
      part2 =
        'Extracted from CBETA text; may include variants or fragments — verify against the source juan.';
      break;
    default:
      part1 = `Các tên xuất hiện trong phạm vi đã quét (${works}), xếp theo tần suất (chưa phải bảng niên phổ phê bình):\n\n${body}`;
      part2 =
        'Danh sách trích xuất từ nguyên văn CBETA; có thể lẫn dị danh / mảnh chữ — cần đối chiếu đúng quyển.';
  }
  return `${part1}\n\n${AI_INTERPRETATION_MARKER}\n${part2}`;
}
