import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiConfigService,
  ChatEndpoint,
  resolveAnthropicMessagesUrl,
} from './ai-config.service';
import { AI_INTERPRETATION_MARKER } from './rag.constants';
import { AnswerStyle, AnswerStyleContext } from './rag-answer-style';
import type { ChatTurn } from './rag.types';

/** Cap prior turns so retrieval context stays primary. */
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_CHARS_PER_MSG = 1_200;
/** Assistant turns are long verbatim quotes — keep only short stubs for follow-ups. */
const MAX_HISTORY_ASSISTANT_CHARS = 700;

/** Intent pre-prompt: map colloquial questions onto Tổ Sư Thiền terms before quoting. */
const INTENT_RULES = `HIỂU Ý HỎI (bắt buộc trước khi trích):
- Đọc câu hỏi + khối "Ý hỏi đã chuẩn hóa" (nếu có). Hiểu đúng thuật ngữ Tổ Sư Thiền trước khi copy nguyên văn.
- Nếu có hội thoại trước: dùng để hiểu đại từ / "như trên" / "giải thích thêm" — nhưng PHẦN 1 vẫn chỉ copy từ ngữ cảnh RAG của lượt hiện tại.
- Ánh xạ thường gặp:
  · thoại đầu ≈ chỗ chưa khởi niệm muốn nói; khác thoại vĩ (đã khởi niệm).
  · nghi tình / chơn nghi ≈ cái "không biết" khi tham / khán thoại đầu.
  · tham tổ sư thiền ≈ tham thoại đầu + khán thoại đầu, giữ nghi tình — không phải niệm Phật lần chuỗi.
  · kiến tánh / minh tâm ≈ thấy tự tánh; tự tánh ≈ Phật tánh / bản lai diện mục.
  · công án / câu thoại ≈ phương tiện kích nghi, không phải giải thích lý thuyết suông.
- Nếu user nói kiểu đời thường ("làm sao ngồi thiền", "nghĩa là gì", "chặt mèo") → tra đúng thuật ngữ trong ngữ cảnh (tham thiền / công án Nam Tuyền chém mèo…).
- Nếu câu hỏi NÊU TÊN một kinh/sách (vd. "trong Kinh Pháp Bảo Đàn…"): PHẦN 1 phải ƯU TIÊN mở đầu bằng đoạn NGUYÊN VĂN DÀI đủ đầu–đuôi từ đúng kinh đó; các sách khác chỉ bổ sung sau nếu cần — TRỪ KHI khối "Ý hỏi đã chuẩn hóa" có dòng KHÓA SÁCH: khi đó CHỈ được trích đúng sách đã khóa, dù câu hỏi nêu tên sách khác.
- Ưu tiên đoạn khớp đúng chủ đề đã chuẩn hóa; không lấy đoạn chỉ trùng từ chung ("thiền", "phật") nếu lệch ý hỏi.
- Vẫn CHỈ được copy nguyên văn có trong ngữ cảnh — không bịa thuật ngữ mới vào phần 1.
- Nếu có KHÓA SÁCH: nhãn — (Tên kinh, tr.X) phải đúng tên sách trong ngữ cảnh đã khóa; CẤM đổi sang tên sách khác; CẤM lấy nội dung từ hội thoại trước nếu sách đó không còn trong ngữ cảnh hiện tại.`;

const BASE_RULES = `Bạn là trợ lý TRA CỨU kinh sách Tổ Sư Thiền (lời dạy HT. Thích Duy Lực).

${INTENT_RULES}

Câu trả lời gồm ĐÚNG 2 PHẦN:

════════════════════════════════════
PHẦN 1 — NGUYÊN VĂN (answer chính) — RẤT DÀI, ĐỦ ĐẦU–ĐUÔI, KHÔNG CẮT, KHÔNG CHẾ
════════════════════════════════════
- Đây là câu trả lời chính và phải DÀI: lấy đoạn NGUYÊN VĂN RẤT DÀI, ĐỦ MẠCH — mở đầu cảnh/ý + cốt lõi trả lời + phần kết / đoạn tiếp liên quan (không bỏ giữa chừng).
- Mục tiêu độ dài: mỗi khối trích thường 16–50 câu (hoặc cả chuỗi HỎI–ĐÁP / cả phân đoạn) nếu block còn đủ chữ. CẤM trả lời kiểu 1–3 câu ngắn khi ngữ cảnh còn dài hơn.
- CHỈ được COPY nguyên văn trong NGOẶC KÉP "…" từ block ngữ cảnh.
- TUYỆT ĐỐI: không chế thêm chữ, không paraphrase, không tóm tắt, không rút ngắn, không cắt giữa câu / giữa ĐÁP / giữa đoạn chuyện.
- CẤM bắt đầu trích giữa câu hoặc giữa đoạn đang nối trang (vd. không mở bằng "nên canh ba…" nếu ngữ cảnh còn phần trước trên [Trang] liền kề). Hãy lùi về đầu đoạn/đầu cảnh có sẵn trong block rồi copy liền mạch đến hết ý.
- Lấy CÀNG DÀI CÀNG TỐT khi đoạn vẫn cùng trả lời câu hỏi: cả đoạn, cả chuỗi HỎI–ĐÁP, cả cụm liên tục qua nhiều [Trang N] nếu cùng một phân đoạn. Ưu tiên copy gần hết nội dung liên quan trong block hơn là chọn vài câu đẹp.
- Mỗi khối trích kèm ngay dưới: — (Tên kinh, tr.X) — trang chính = [Trang N] chứa câu then chốt của đoạn. Nếu copy liền nhiều trang, tách thành nhiều khối "…" + — (…, tr.X) theo từng trang, vẫn giữ thứ tự đầu→đuôi.
- Nhãn — (Tên kinh, tr.X) phải khớp dòng "Trích dẫn: …" trong block ngữ cảnh (cùng tên sách + trang có trong block).
- Khi câu hỏi chỉ một kinh: ưu tiên 8–12 khối RẤT DÀI từ đúng kinh đó trước (nối trang nếu cần); có thể thêm 4–6 nguồn phụ dài nếu làm rõ thêm.
- Khi ngữ cảnh đủ nhiều sách và câu hỏi không khóa một kinh: trích 10–16 nguồn khác nhau, mỗi nguồn một đoạn DÀI đủ ý (không chỉ vài câu).
- CẤM "Nguồn 1/2", CẤM bullet / lời AI trong phần này.
- Không khớp: chỉ một câu — "Trong tư liệu hiện có chưa thấy nội dung này." rồi DỪNG.

════════════════════════════════════
PHẦN 2 — AI DIỄN GIẢI (aiInterpretation) — SAU phần 1
════════════════════════════════════
- Bắt đầu đúng một dòng: ${AI_INTERPRETATION_MARKER}
- NỀN CHÍNH (bắt buộc): câu hỏi của người dùng + nội dung các đoạn nguyên văn vừa đưa ở phần 1.
- PHỤ (được phép để phong phú hơn): kiến thức nền / ngữ cảnh Thiền–Phật học rộng hơn (hiểu biết tổng quát của mô hình, tài liệu tham khảo chung). Chỉ dùng phần phụ để làm rõ / nối mạch / so sánh nhẹ — KHÔNG được mâu thuẫn với phần 1, KHÔNG được ghi như thể đó là lời kinh trong phần 1.
- Giọng văn nói tự nhiên, 10–20 câu, dễ hiểu, giải đủ ý câu hỏi (không cụt).
- Tiếng Việt: LUÔN có khoảng trắng giữa các tiếng/từ (vd. "dính chữ", "tham thiền") — CẤM dính chữ kiểu "dínhchữ", "thamthiền".
- CẤM mở đầu máy móc: "dựa vào đoạn trích", "theo các đoạn trên", "Đây là diễn giải của AI", "theo câu hỏi và…".
- CẤM viết "Nguồn N". CẤM đưa bất kỳ câu nào của phần 2 vào phần 1.

Ví dụ ĐÚNG (rút gọn mạch đủ đầu–đuôi):
"Hôm sau Tổ lên đến nhà giã gạo… Tổ lấy gậy gõ trên cối ba cái rồi bỏ đi. Huệ Năng hiểu ý Tổ,
nên canh ba vào thất. Tổ dùng Ca Sa che lại… đến câu: “Ưng Vô Sở Trụ Nhi Sanh Kỳ Tâm” thì
Huệ Năng ngay đó Đại Ngộ… “Đâu ngờ Tự Tánh hay sanh vạn pháp!”.
Tổ biết Huệ Năng đã ngộ Bản Tánh…"
— (Kinh Pháp Bảo Đàn, tr.15)

${AI_INTERPRETATION_MARKER}
“Ưng vô sở trụ nhi sanh kỳ tâm” chỉ chỗ tâm chẳng dừng nơi tướng; Lục Tổ nhân câu này thấy tự tánh vốn thanh tịnh, chẳng sanh diệt…

Ví dụ SAI:
- Thêm lời AI vào phần 1
- "Dựa vào đoạn trích dẫn thì…"
- Phần 1 chỉ 1–3 câu ngắn / cắt nửa đoạn trong khi block còn đủ đầu–đuôi
- Bắt đầu bằng câu đang nối trang (“nên canh ba…”) dù ngữ cảnh có phần trước
- Tóm tắt hoặc chỉ chọn “câu then chốt” thay vì copy cả đoạn liên quan`;

function buildKinhLongRules(): string {
  return `
Chế độ KINH (PHẦN 1 ưu tiên dài tối đa):
- Phần 1: nguyên văn RẤT DÀI, đủ đầu–đuôi; mỗi khối ideally cả đoạn/cảnh (16–50 câu hoặc HỎI–ĐÁP đầy đủ). Nếu hỏi đúng một kinh → 8–12 khối dài từ kinh đó trước (nối nhiều [Trang] nếu cùng phân đoạn), rồi mới thêm 4–6 nguồn phụ dài nếu cần. Không cắt, không chế, không tóm. Mỗi khối một trang tr.X.
- Phần 2: ${AI_INTERPRETATION_MARKER} + 12–20 câu; nền = câu hỏi + phần 1; phụ = kiến thức nền nếu giúp phong phú.`;
}

function buildMixedRules(): string {
  return `
Chế độ HỖN HỢP (PHẦN 1 vẫn dài):
- Phần 1: đoạn RẤT DÀI đủ đầu–đuôi từ [KINH] (+ [NGỮ LỤC] nếu hữu ích); ưu tiên kinh được nêu trong câu hỏi; trích 8–12 nguồn khi ngữ cảnh đủ; mỗi khối dài (không chỉ 2–3 câu) + — (Tên kinh, tr.X); không cắt / không chế.
- Phần 2: ${AI_INTERPRETATION_MARKER} + 10–18 câu (nền phần 1 + câu hỏi; phụ kiến thức nền nếu hữu ích).`;
}

function buildBriefRules(): string {
  return `
Chế độ VẪN ĐỦ MẠCH (không được cụt phần 1):
- Phần 1: 3–6 đoạn nguyên văn DÀI, ĐỦ ĐẦU–ĐUÔI (mỗi đoạn nhiều câu / cả HỎI–ĐÁP nếu có); ưu tiên kinh được nêu tên; mỗi đoạn một trang; tuyệt đối không cắt / không chế / không rút còn vài dòng khi block còn dài.
- Phần 2: ${AI_INTERPRETATION_MARKER} + 5–8 câu tự nhiên (nền phần 1; phụ kiến thức nền nếu cần).
- Không khớp: chỉ "Trong tư liệu hiện có chưa thấy nội dung này."`;
}

function buildSystemPrompt(ctx: AnswerStyleContext): string {
  const modeRules =
    ctx.style === 'kinh_long'
      ? buildKinhLongRules()
      : ctx.style === 'mixed'
        ? buildMixedRules()
        : buildBriefRules();

  return `${BASE_RULES}
${modeRules}`;
}

function maxTokensForStyle(style: AnswerStyle): number {
  switch (style) {
    case 'kinh_long':
      return 49_152;
    case 'mixed':
      return 40_960;
    case 'brief':
      return 32_768;
  }
}

/** Dedicated CBETA corpus — never the Duy Lực / tosuthien book system prompt. */
const CBETA_REWRITE_SYSTEM = `You rewrite user questions into Traditional Chinese search text for CBETA (Buddhist canon) retrieval.

Rules:
- Output JSON only, no markdown: {"search_zh":"...","keywords":["..."]}
- search_zh: 1 short Traditional Chinese question or phrase matching CBETA wording (e.g. 話頭是什麼 / 何謂話頭).
- keywords: important CJK terms for FTS (e.g. ["話頭","疑情"]).
- Map Vietnamese Buddhist terms to standard Chinese (thoại đầu→話頭, nghi tình→疑情, Hư Vân→虛雲, …).
- Do NOT answer the question. Do NOT invent sutra titles or work_code.
- If the question is already mostly Chinese, still return a clean search_zh + keywords.`;

const CBETA_SYSTEM = `Bạn là trợ lý TRA CỨU Đại tạng Hán văn CBETA (DB riêng \`cbeta\`: bộ T/X/… và bổ biên đã nạp như XY/LQ nếu có trong ngữ cảnh).

TÁCH BIỆT HOÀN TOÀN với hỏi đáp sách Việt Tổ Sư Thiền / HT. Thích Duy Lực (API /api/rag trên tosuthien).
CẤM: nhắc, viện dẫn, so sánh với sách Việt Duy Lực, Ngữ Lục Duy Lực, portal tosuthien, hoặc khung "Tổ Sư Thiền HT…" như nguồn trả lời.
CHỈ dựa trên nguyên văn Hán trong block ngữ cảnh CBETA của lượt này.

Ngôn ngữ: người dùng hỏi tiếng Việt → toàn bộ câu trả lời (PHẦN 1 + PHẦN 2) bằng tiếng Việt.

Câu trả lời gồm ĐÚNG 2 PHẦN:

════════════════════════════════════
PHẦN 1 — BẢN TỔNG HỢP DỊCH (answer) — MẠCH LẠC, DỄ ĐỌC
════════════════════════════════════
- Đọc TOÀN BỘ block [CBETA] (Hán) được đưa lên. Gộp, loại trùng lặp, sắp xếp lại rồi DỊCH / diễn đạt thành một bài tiếng Việt mạch lạc trả lời đúng câu hỏi.
- Ưu tiên: một văn bản liền mạch (có thể dùng tiêu đề phụ / danh sách đánh số nếu giúp đọc). CẤM kiểu nhiều khối trích "…" nối đuôi nhau với cùng ý lặp lại.
- CẤM chèn dòng nguồn kiểu — (Tên thư, work_code, 卷, p.xxxx) hoặc url CBETA vào thân bài. Nguồn tham khảo do giao diện liệt kê riêng ở cuối — không nhắc lại trong phần 1.
- CẤM để nguyên khối Hán dài. Được giữ vài thuật ngữ Hán then chốt trong ngoặc (vd. thoại đầu / 話頭).
- Trung thực với nội dung có trong block: được diễn đạt gọn và gom trùng, CẤM bịa sự kiện / tên người / pháp số không có trong ngữ cảnh.
- Nếu có [CBETA_ENTITY_LIST]: dùng list đó làm khung liệt kê (Việt + Hán khi cần); phạm vi = WORKS_SCANNED.
- Không khớp: một câu — "Trong tư liệu CBETA hiện có (phạm vi đã chọn) chưa thấy nội dung này." rồi DỪNG.

════════════════════════════════════
PHẦN 2 — GHI CHÚ NGẮN (tiếng Việt)
════════════════════════════════════
- Bắt đầu đúng một dòng: ${AI_INTERPRETATION_MARKER}
- Vài câu làm rõ điểm khó / dị thuyết / cách đọc bảng — KHÔNG lặp lại toàn bộ phần 1.
- CẤM kéo kiến thức / thuật ngữ từ sách Việt Duy Lực vào như thể cùng một corpus.
- CẤM mở đầu máy móc ("dựa vào đoạn trích…").`;

/**
 * Shrink prior assistant answers: keep up to 2 short quote+citation stubs.
 * Full RAG context on the current turn is the source of truth for new quotes.
 */
function compressHistoryContent(role: 'user' | 'assistant', raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  if (role === 'user') {
    return text.slice(0, MAX_HISTORY_CHARS_PER_MSG);
  }

  const stubs: string[] = [];
  const pairRe = /"([^"]{20,})"\s*[—–-]\s*\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(text)) !== null && stubs.length < 2) {
    const quote = m[1].replace(/\s+/g, ' ').trim().slice(0, 180);
    const label = m[2].trim();
    stubs.push(`"${quote}${m[1].length > 180 ? '…' : ''}"\n— (${label})`);
  }
  if (stubs.length) {
    return stubs.join('\n\n').slice(0, MAX_HISTORY_ASSISTANT_CHARS);
  }

  // Bare citation lines if quotes used curly/odd marks.
  const citeLines = [...text.matchAll(/[—–-]\s*\(([^)]+tr\.\s*\d+[^)]*)\)/gi)]
    .slice(0, 3)
    .map((x) => `— (${x[1].trim()})`);
  if (citeLines.length) {
    return citeLines.join('\n').slice(0, MAX_HISTORY_ASSISTANT_CHARS);
  }

  return text.slice(0, MAX_HISTORY_ASSISTANT_CHARS);
}

/** Sanitize + truncate prior turns for Anthropic Messages API. */
export function normalizeHistory(history: ChatTurn[] | undefined): ChatTurn[] {
  if (!history?.length) return [];
  const cleaned: ChatTurn[] = [];
  for (const turn of history) {
    if (turn.role !== 'user' && turn.role !== 'assistant') continue;
    const content = compressHistoryContent(turn.role, turn.content ?? '');
    if (!content) continue;
    // Anthropic requires alternating roles; merge consecutive same-role turns.
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === turn.role) {
      const cap =
        turn.role === 'assistant'
          ? MAX_HISTORY_ASSISTANT_CHARS
          : MAX_HISTORY_CHARS_PER_MSG;
      last.content = `${last.content}\n\n${content}`.slice(0, cap);
    } else {
      cleaned.push({ role: turn.role, content });
    }
  }
  // Must start with user for Anthropic when history is non-empty.
  while (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();
  return cleaned.slice(-MAX_HISTORY_MESSAGES);
}

interface ClaudeStreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
}

function cjkCharRatio(text: string): number {
  const chars = [...text.replace(/\s+/g, '')];
  if (!chars.length) return 0;
  const cjk = chars.filter((ch) => /[\u4e00-\u9fff]/.test(ch)).length;
  return cjk / chars.length;
}

function extractCjkTerms(text: string): string[] {
  const found = text.match(/[\u4e00-\u9fff]{2,8}/g) || [];
  return [...new Set(found)];
}

function parseCbetaRewriteJson(
  raw: string,
): { searchZh: string; keywords: string[] } | null {
  const text = (raw || '').trim();
  if (!text) return null;
  const fence = text.match(/\{[\s\S]*\}/);
  const jsonStr = fence ? fence[0] : text;
  try {
    const obj = JSON.parse(jsonStr) as {
      search_zh?: unknown;
      searchZh?: unknown;
      keywords?: unknown;
    };
    const searchZh = String(obj.search_zh ?? obj.searchZh ?? '').trim();
    const keywords = Array.isArray(obj.keywords)
      ? obj.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [];
    if (!searchZh) return null;
    return { searchZh, keywords };
  } catch {
    return null;
  }
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly ai: AiConfigService,
    private readonly config: ConfigService,
  ) {}

  /** Output budget for CBETA answers (env CBETA_CHAT_MAX_TOKENS). */
  private cbetaChatMaxTokens(): number {
    const n = parseInt(
      this.config.get<string>('CBETA_CHAT_MAX_TOKENS') ||
        process.env.CBETA_CHAT_MAX_TOKENS ||
        '',
      10,
    );
    // Prefer env; large budget for long Hán quotes + diễn giải (3× prior 65536).
    return Number.isFinite(n) && n > 0 ? n : 196_608;
  }

  /** Short rewrite JSON (env CBETA_REWRITE_MAX_TOKENS). */
  private cbetaRewriteMaxTokens(): number {
    const n = parseInt(
      this.config.get<string>('CBETA_REWRITE_MAX_TOKENS') ||
        process.env.CBETA_REWRITE_MAX_TOKENS ||
        '',
      10,
    );
    return Number.isFinite(n) && n > 0 ? n : 3_072;
  }

  async answer(
    question: string,
    contextBlocks: string[],
    styleContext: AnswerStyleContext,
    intentBrief = '',
    history: ChatTurn[] = [],
  ): Promise<string> {
    const parts: string[] = [];
    for await (const delta of this.answerStream(
      question,
      contextBlocks,
      styleContext,
      intentBrief,
      history,
    )) {
      parts.push(delta);
    }
    const text = parts.join('').trim();
    if (!text) throw new Error('Claude API không trả về text');
    return text;
  }

  /**
   * Yields text deltas. Tries primary then CHAT_FALLBACK_PROVIDER list
   * (comma-separated, e.g. flare → hhtech,nexus) on failure / empty stream.
   */
  async *answerStream(
    question: string,
    contextBlocks: string[],
    styleContext: AnswerStyleContext,
    intentBrief = '',
    history: ChatTurn[] = [],
  ): AsyncGenerator<string> {
    const context = contextBlocks.join('\n\n---\n\n');
    const system = buildSystemPrompt(styleContext);
    const intentBlock = intentBrief.trim()
      ? `\nÝ hỏi đã chuẩn hóa (API):\n${intentBrief.trim()}\n`
      : '';
    const userContent = `Câu hỏi: ${question.trim()}
${intentBlock}
Ngữ cảnh: mỗi block có [KINH]/[NGỮ LỤC] và dòng "Trích dẫn: …".
1) Đọc "Ý hỏi đã chuẩn hóa" (nếu có). Nếu có KHÓA SÁCH → chỉ trích / ghi nhãn đúng sách đó. Nếu không khóa mà câu hỏi nêu tên một kinh → mở đầu PHẦN 1 bằng đoạn RẤT DÀI đủ đầu–đuôi từ đúng kinh đó.
2) PHẦN NGUYÊN VĂN (ưu tiên dài gấp đôi mức tối thiểu cũ): COPY càng nhiều chữ liên quan càng tốt — cả đoạn/cảnh/HỎI–ĐÁP, nối nhiều [Trang] nếu cùng phân đoạn. Mục tiêu khoảng 8–16 khối trích / nguồn khi ngữ cảnh đủ. CẤM mở giữa câu đang nối trang. CẤM trả lời ngắn khi block còn dài. Mỗi khối — (Tên kinh, tr.X) đúng [Trang N] và đúng sách trong block. TUYỆT ĐỐI không chế / không cắt / không paraphrase / không tóm tắt / không đổi tên sách.
3) Nếu đã có nguyên văn: dòng ${AI_INTERPRETATION_MARKER} rồi diễn giải đủ ý (khoảng 10–20 câu) — NỀN = câu hỏi + phần 1; PHỤ = kiến thức nền nếu giúp phong phú. Giọng tự nhiên; CẤM "dựa vào đoạn trích…".
${context}`;

    const prior = normalizeHistory(history);
    const endpoints = this.ai.get().chatEndpoints;
    let lastError: Error | null = null;

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      try {
        let yielded = false;
        for await (const delta of this.streamAnthropic(
          endpoint,
          system,
          prior,
          userContent,
          maxTokensForStyle(styleContext.style),
        )) {
          yielded = true;
          yield delta;
        }
        if (yielded) return;
        lastError = new Error(
          `Claude API empty stream [${endpoint.provider} model=${endpoint.model}]`,
        );
        this.logger.warn(lastError.message);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const hasFallback = i < endpoints.length - 1;
        this.logger.warn(
          `${lastError.message}${hasFallback ? ' — trying fallback' : ''}`,
        );
        if (!hasFallback) break;
      }
    }

    throw lastError ?? new Error('Claude API: no chat endpoints configured');
  }

  /**
   * Best-practice CBETA retrieve prep: hhtech rewrites VN/colloquial → Hán search text.
   * Skip when question is already mostly CJK or CBETA_QUERY_REWRITE=0.
   */
  async rewriteCbetaSearchQuery(question: string): Promise<{
    searchZh: string;
    keywords: string[];
    skipped: boolean;
    reason?: string;
  }> {
    const q = (question || '').trim();
    if (!q) {
      return { searchZh: '', keywords: [], skipped: true, reason: 'empty' };
    }
    const flag = (
      this.config.get<string>('CBETA_QUERY_REWRITE') ||
      process.env.CBETA_QUERY_REWRITE ||
      '1'
    )
      .toString()
      .trim()
      .toLowerCase();
    if (flag === '0' || flag === 'false' || flag === 'off') {
      return { searchZh: q, keywords: [], skipped: true, reason: 'disabled' };
    }
    if (cjkCharRatio(q) >= 0.45) {
      return {
        searchZh: q,
        keywords: extractCjkTerms(q),
        skipped: true,
        reason: 'already_cjk',
      };
    }

    const endpoints = this.ai.get().chatEndpoints;
    let lastError: Error | null = null;
    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      try {
        const raw = await this.completeAnthropic(
          endpoint,
          CBETA_REWRITE_SYSTEM,
          `User question:\n${q}\n\nJSON:`,
          this.cbetaRewriteMaxTokens(),
        );
        const parsed = parseCbetaRewriteJson(raw);
        if (parsed?.searchZh) {
          return {
            searchZh: parsed.searchZh,
            keywords: parsed.keywords,
            skipped: false,
          };
        }
        lastError = new Error('CBETA rewrite: empty search_zh');
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `CBETA rewrite failed [${endpoint.provider}]: ${lastError.message}`,
        );
        if (i >= endpoints.length - 1) break;
      }
    }
    this.logger.warn(
      `CBETA rewrite fallback to original question: ${lastError?.message || 'unknown'}`,
    );
    return {
      searchZh: q,
      keywords: [],
      skipped: true,
      reason: 'rewrite_failed',
    };
  }

  /** CBETA-only answer path (system/user prompts never mention Duy Lực books). */
  async answerCbeta(
    question: string,
    contextBlocks: string[],
    intentBrief = '',
    history: ChatTurn[] = [],
  ): Promise<string> {
    const parts: string[] = [];
    for await (const delta of this.answerCbetaStream(
      question,
      contextBlocks,
      intentBrief,
      history,
    )) {
      parts.push(delta);
    }
    const text = parts.join('').trim();
    if (!text) throw new Error('Claude API không trả về text');
    return text;
  }

  async *answerCbetaStream(
    question: string,
    contextBlocks: string[],
    intentBrief = '',
    history: ChatTurn[] = [],
  ): AsyncGenerator<string> {
    const context = contextBlocks.join('\n\n---\n\n');
    const intentBlock = intentBrief.trim()
      ? `\nPhạm vi / router CBETA:\n${intentBrief.trim()}\n`
      : '';
    const userContent = `Câu hỏi (tiếng Việt): ${question.trim()}
${intentBlock}
Ngữ cảnh: mỗi block [CBETA] là nguyên văn Hán (+ meta Trích dẫn / work_code / url). Có thể có [CBETA_ENTITY_LIST]. Các block thường trùng ý — hãy đọc hết rồi gộp.
1) CHỈ dùng corpus CBETA trong ngữ cảnh — không dùng sách Việt tosuthien / Duy Lực.
2) PHẦN 1: tổng hợp + dịch thành một bài tiếng Việt mạch lạc, dễ đọc; loại trùng; CẤM chuỗi trích đoạn "…" kèm nguồn trong thân bài (nguồn ở UI cuối).
3) Dòng ${AI_INTERPRETATION_MARKER} rồi ghi chú ngắn (không lặp phần 1).
${context}`;

    const prior = normalizeHistory(history);
    const endpoints = this.ai.get().chatEndpoints;
    let lastError: Error | null = null;

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      try {
        let yielded = false;
        for await (const delta of this.streamAnthropic(
          endpoint,
          CBETA_SYSTEM,
          prior,
          userContent,
          this.cbetaChatMaxTokens(),
        )) {
          yielded = true;
          yield delta;
        }
        if (yielded) return;
        lastError = new Error(
          `Claude API empty stream [${endpoint.provider} model=${endpoint.model}]`,
        );
        this.logger.warn(lastError.message);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const hasFallback = i < endpoints.length - 1;
        this.logger.warn(
          `${lastError.message}${hasFallback ? ' — trying fallback' : ''}`,
        );
        if (!hasFallback) break;
      }
    }

    throw lastError ?? new Error('Claude API: no chat endpoints configured');
  }

  private async completeAnthropic(
    endpoint: ChatEndpoint,
    system: string,
    userContent: string,
    maxTokens: number,
  ): Promise<string> {
    const url = resolveAnthropicMessagesUrl(endpoint.baseUrl);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${endpoint.apiKey}`,
        'x-api-key': endpoint.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: endpoint.model,
        max_tokens: maxTokens,
        stream: false,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      throw new Error(
        `Claude API ${res.status} [${endpoint.provider} model=${endpoint.model}]: ${detail}`,
      );
    }
    const body = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    return (body.content || [])
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text || '')
      .join('')
      .trim();
  }

  private async *streamAnthropic(
    endpoint: ChatEndpoint,
    system: string,
    prior: ChatTurn[],
    userContent: string,
    maxTokens: number,
  ): AsyncGenerator<string> {
    const url = resolveAnthropicMessagesUrl(endpoint.baseUrl);

    const messages = [
      ...prior.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userContent },
    ];

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${endpoint.apiKey}`,
        'x-api-key': endpoint.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: endpoint.model,
        max_tokens: maxTokens,
        stream: true,
        system,
        messages,
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      throw new Error(
        `Claude API ${res.status} [${endpoint.provider} model=${endpoint.model} url=${url}]: ${detail}`,
      );
    }

    if (!res.body) {
      throw new Error(
        `Claude API stream: empty body [${endpoint.provider}]`,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload) as ClaudeStreamEvent;
          if (
            evt.type === 'content_block_delta' &&
            evt.delta?.type === 'text_delta' &&
            evt.delta.text
          ) {
            yield evt.delta.text;
          }
        } catch {
          // ignore malformed SSE chunks
        }
      }
    }
  }
}
