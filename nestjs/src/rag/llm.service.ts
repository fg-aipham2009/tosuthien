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
import { extractPreservedCjk } from './cbeta/cbeta-query-parse.util';
import {
  toTraditionalZh,
  toTraditionalZhList,
} from './cbeta/cbeta-opencc.util';
import { LruCache } from './cbeta/cbeta-lru.util';
import {
  assertCbetaAnswerLang,
  cbetaAnswerPrefill,
  shouldBufferCbetaHead,
  stripLeadingMetaPlanning,
} from './cbeta/cbeta-answer-quality.util';
import {
  detectCbetaAnswerLang,
  isCbetaBriefQuestion,
  isCbetaCoverageIntent,
} from './cbeta/cbeta-intent.util';

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
const CBETA_REWRITE_SYSTEM = `You map user questions into CBETA retrieval cues (Traditional Chinese / 文言 Buddhist terms).

Output JSON only, no markdown:
{"search_zh":"...","keywords_literal":["..."],"keywords_doctrine":["..."],"keywords":["..."]}

Hard rules (3 bugs to avoid):
1) CLASSICAL, NOT modern Mandarin: Do NOT write 白话 sentences like 佛陀對阿難說了關於心的什麼. Emit compact 文言 / CBETA-style terms (佛告阿難、徵心、妄心、真心、坐禪、昏沉…).
2) KEEP LITERALS: keywords_literal = names, koan titles, exact phrases, any CJK already in the user text (e.g. 趙州洗鉢, 應無所住). Never drop user-provided Hanzi. keywords_doctrine = short doctrinal synonyms only (平常心、話頭…) — optional, few items.
3) NO DOCTRINE ESSAY / NO ANSWER: terminology mapping & translation only. Do NOT explain the teaching, invent causes, or expand into a HyDE-style paragraph.

Also:
- search_zh: space-separated compact Traditional Chinese retrieval cues (prefer 文言).
- keywords: union of literal + doctrine (optional convenience field).
- Map Vietnamese → classical CBETA terms (thoại đầu→話頭, nghi tình→疑情, buồn ngủ khi ngồi thiền→坐禪 昏沉, …).
- LIST / "toàn bộ tổ sư": add lineage anchors 西天二十八祖、東土六祖、景德傳燈錄、五燈會元… as search terms only — never invent work_code.
- If prior turns are given, resolve pronouns ("ông ấy", "công án đó", "pháp này") into concrete nouns before mapping.
- Do NOT invent work_code / juan / page.`;

const CBETA_SYSTEM = `Bạn là trợ lý TRA CỨU Đại tạng Hán văn CBETA (DB riêng \`cbeta\`: bộ T/X/… và bổ biên đã nạp như XY/LQ nếu có trong ngữ cảnh).

TÁCH BIỆT HOÀN TOÀN với hỏi đáp sách Việt Tổ Sư Thiền / HT. Thích Duy Lực (API /api/rag trên tosuthien).
CẤM: nhắc, viện dẫn, so sánh với sách Việt Duy Lực, Ngữ Lục Duy Lực, portal tosuthien, hoặc khung "Tổ Sư Thiền HT…" như nguồn trả lời.
CHỈ dựa trên nguyên văn Hán trong block ngữ cảnh CBETA của lượt này.
CẤM bịa nguyên văn / work_code / locator / lời Phật / pháp số không có trong block.
Khi intent brief có SCRIPTURE_GROUNDING: tách 原文 (theo block) · 文義 · 註疏 (chỉ khi có chú疏 trong ngữ cảnh, ghi rõ tác giả chú — CẤM gọi chú là kinh).
Nếu thiếu bằng chứng: nói rõ giới hạn rồi DỪNG — CẤM suy diễn giáo nghĩa.

Phân biệt góc nhìn trong block (nhãn [Tổ_Sư_Thiền] / [Giáo_môn] / [Tục_tạng] / …):
- Giáo môn: Kinh/Luận/Luật theo thứ lớp giáo nghĩa.
- Tổ Sư Thiền: ngữ lục, đèn lục, công án, trực chỉ — cách tu khác Giáo môn.
CẤM gộp chung "cách tu" của hai dòng như thể một pháp duy nhất; nếu ngữ cảnh có cả hai, nêu rõ từng góc nhìn.

Ngôn ngữ trả lời (BẮT BUỘC — pipe: mọi câu hỏi → tra Hán CBETA → trả lời đúng ngôn ngữ đầu vào):
- ƯU TIÊN: câu hỏi có tiếng Việt (kể cả không dấu) → PHẦN 1 + PHẦN 2 bằng tiếng Việt. CẤM trả lời tiếng Anh.
- Câu hỏi tiếng Trung / Hán (简体或繁體, không lẫn Việt) → PHẦN 1 + PHẦN 2 bằng tiếng Trung cùng hệ chữ. CẤM Việt / Anh.
- Câu hỏi tiếng Anh thuần → PHẦN 1 + PHẦN 2 bằng tiếng Anh (tổng hợp từ Hán). CẤM Việt.
- Dòng ANSWER_LANG=vi|zh|en trong intent brief là TỐI THƯỢNG — tuân thủ tuyệt đối, kể cả khi ngữ cảnh Hán hoặc hội thoại trước khác ngôn ngữ.
- Không đổi ngôn ngữ giữa hai phần. Không “nghĩ bằng English rồi trả lời” khi ANSWER_LANG=vi.
- CẤM mọi English meta / planning ở đầu bài: "I'm noting…", "I need…", "The entity list…", "Looking at…", "First I…". Viết thẳng nội dung PHẦN 1.

Câu trả lời gồm ĐÚNG 2 PHẦN:

════════════════════════════════════
PHẦN 1 — BẢN TỔNG HỢP (answer) — RÕ, ĐỦ, DỄ ĐỌC
════════════════════════════════════
- Đọc TOÀN BỘ block [CBETA] (+ entity list nếu có). Gộp trùng, sắp xếp logic, rồi viết một bài mạch lạc đúng ngôn ngữ câu hỏi.
- Câu hỏi kiểu liệt kê / truyền thừa: trình bày theo khung rõ (vd. A. Tây Thiên / 西天 1→28; B. Đông Độ / 東土 1→6; C. dị thuyết nếu có). Mỗi vị một dòng: số thứ tự — tên theo ngôn ngữ trả lời (kèm Hán nếu hữu ích). Đủ số lượng có trong ngữ cảnh; CẤM cắt giữa danh sách bằng "…".
- Câu hỏi thường: văn xuôi có tiêu đề phụ ngắn; mỗi ý một lần — CẤM lặp cùng nội dung từ nhiều block.
- CẤM chuỗi trích "…" và CẤM chèn — (thư, work_code, 卷, p.xxxx) / url trong thân bài (nguồn ở UI cuối).
- Thẻ 【p….】 / 【chunk:N】 trong block là mốc dòng khi ghép neighbor — dùng để giữ mạch, không bịa citation mới.
- Khi trả lời tiếng Việt / Anh: tổng hợp từ Hán trong ngữ cảnh; CẤM để nguyên khối Hán dài; được giữ thuật ngữ Hán then chốt trong ngoặc. Khi trả lời tiếng Trung: viết bằng Hán, trích ngắn thuật ngữ then chốt nếu cần — không nhồi nguyên khối dài không cần thiết. Khi ANSWER_LANG=en: toàn bộ bài bằng English, zero Vietnamese.
- Trung thực với ngữ cảnh; CẤM bịa tên / pháp số không có trong block.
- Nếu có [CBETA_ENTITY_LIST]: ưu tiên làm xương sống danh sách (tên theo ngôn ngữ trả lời + Hán).
- Nếu các block không trả lời được câu hỏi: một câu thông báo "không thấy trong phạm vi CBETA đã chọn" đúng ngôn ngữ câu hỏi rồi DỪNG — tuyệt đối không suy diễn.

════════════════════════════════════
PHẦN 2 — GHI CHÚ NGẮN (cùng ngôn ngữ câu hỏi)
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
      keywords_literal?: unknown;
      keywords_doctrine?: unknown;
    };
    const searchZh = String(obj.search_zh ?? obj.searchZh ?? '').trim();
    const asList = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.map((k) => String(k).trim()).filter(Boolean)
        : [];
    const literal = asList(obj.keywords_literal);
    const doctrine = asList(obj.keywords_doctrine);
    const plain = asList(obj.keywords);
    const keywords = [...new Set([...literal, ...doctrine, ...plain])];
    if (!searchZh && !keywords.length) return null;
    return {
      searchZh: searchZh || keywords.join(' '),
      keywords,
    };
  } catch {
    return null;
  }
}

type CbetaRewriteResult = {
  searchZh: string;
  keywords: string[];
  skipped: boolean;
  reason?: string;
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private rewriteCache: LruCache<CbetaRewriteResult> | null = null;

  constructor(
    private readonly ai: AiConfigService,
    private readonly config: ConfigService,
  ) {}

  /** Output budget for CBETA answers (env CBETA_CHAT_MAX_TOKENS). */
  private cbetaChatMaxTokens(brief = false): number {
    if (brief) {
      const b = parseInt(
        this.config.get<string>('CBETA_BRIEF_MAX_TOKENS') ||
          process.env.CBETA_BRIEF_MAX_TOKENS ||
          '',
        10,
      );
      // Brief/summary questions — keep answer short for latency.
      return Number.isFinite(b) && b > 0 ? b : 6_144;
    }
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

  /**
   * Hard deadline for VN/EN→Hán rewrite. Without this, hhtech/Opus can hang
   * forever and the SSE UI stays on "Đang chuẩn hóa câu hỏi…".
   */
  private cbetaRewriteTimeoutMs(): number {
    const n = parseInt(
      this.config.get<string>('CBETA_REWRITE_TIMEOUT_MS') ||
        process.env.CBETA_REWRITE_TIMEOUT_MS ||
        '',
      10,
    );
    return Number.isFinite(n) && n > 0 ? n : 15_000;
  }

  /**
   * Hard deadline for CBETA answer streams (connect + body). Without this,
   * a stuck hhtech SSE leaves the UI on prefill-only forever.
   */
  private cbetaChatTimeoutMs(): number {
    const n = parseInt(
      this.config.get<string>('CBETA_CHAT_TIMEOUT_MS') ||
        process.env.CBETA_CHAT_TIMEOUT_MS ||
        '',
      10,
    );
    // Fail over to the next chat endpoint quickly when hhtech hangs.
    return Number.isFinite(n) && n > 0 ? n : 60_000;
  }

  private rewriteCacheSize(): number {
    const n = parseInt(
      this.config.get<string>('CBETA_REWRITE_CACHE_SIZE') ||
        process.env.CBETA_REWRITE_CACHE_SIZE ||
        '',
      10,
    );
    // 0 = disable cache; unset → modest in-memory LRU.
    if (Number.isFinite(n) && n >= 0) return n;
    return 256;
  }

  private getRewriteCache(): LruCache<CbetaRewriteResult> {
    if (!this.rewriteCache) {
      this.rewriteCache = new LruCache(this.rewriteCacheSize());
    }
    return this.rewriteCache;
  }

  /**
   * Prefer a fast rewrite model (CBETA_REWRITE_MODEL / HHTECH_REWRITE_MODEL).
   * At most two attempts — never walk the full chat fallback chain (each can hang).
   */
  private rewriteEndpoints(): ChatEndpoint[] {
    const cfg = this.ai.get();
    const rewriteModel = (
      this.config.get<string>('CBETA_REWRITE_MODEL') ||
      this.config.get<string>('HHTECH_REWRITE_MODEL') ||
      process.env.CBETA_REWRITE_MODEL ||
      process.env.HHTECH_REWRITE_MODEL ||
      ''
    ).trim();
    const primary = cfg.chatEndpoints[0];
    if (!primary) return [];
    if (!rewriteModel || rewriteModel === primary.model) {
      return [primary];
    }
    const light: ChatEndpoint = { ...primary, model: rewriteModel };
    return [light, primary];
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
    const endpoints = this.ai.orderedChatEndpoints();
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
   * CBETA retrieve prep: terminology map VN/colloquial → classical Hán cues.
   * Always OpenCC→Traditional; always re-attach CJK spans from the raw question.
   * Optional prior turns (1–2) resolve pronouns before mapping.
   */
  async rewriteCbetaSearchQuery(
    question: string,
    history: ChatTurn[] = [],
  ): Promise<CbetaRewriteResult> {
    const q = (question || '').trim();
    if (!q) {
      return { searchZh: '', keywords: [], skipped: true, reason: 'empty' };
    }
    const preserved = extractPreservedCjk(q);
    const finalize = (
      searchZh: string,
      keywords: string[],
      skipped: boolean,
      reason?: string,
    ): CbetaRewriteResult => {
      const kw = toTraditionalZhList([
        ...keywords,
        ...preserved,
        ...extractCjkTerms(searchZh),
      ]);
      const mergedSearch = toTraditionalZh(
        [searchZh, ...preserved].filter(Boolean).join(' ').trim() || q,
      );
      return {
        searchZh: mergedSearch,
        keywords: kw,
        skipped,
        reason,
      };
    };

    const prior = normalizeHistory(history).slice(-2);
    const cacheKey = `${q}\n---\n${prior.map((t) => `${t.role}:${t.content}`).join('\n')}`;
    const cache = this.getRewriteCache();
    const cached = cache.get(cacheKey);
    if (cached) {
      return { ...cached, reason: cached.reason || 'cache_hit' };
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
      const r = finalize(q, extractCjkTerms(q), true, 'disabled');
      cache.set(cacheKey, r);
      return r;
    }
    if (cjkCharRatio(q) >= 0.45) {
      const r = finalize(q, extractCjkTerms(q), true, 'already_cjk');
      cache.set(cacheKey, r);
      return r;
    }

    const historyBlock = prior.length
      ? `Prior turns (resolve pronouns only; do not answer):\n${prior
          .map((t) => `${t.role}: ${t.content}`)
          .join('\n')}\n\n`
      : '';

    // Prefer light rewrite model; never throw — fallback to raw query for embed/FTS.
    // Each attempt has a hard timeout so SSE cannot stick on "chuẩn hóa…".
    const endpoints = this.rewriteEndpoints();
    const timeoutMs = this.cbetaRewriteTimeoutMs();
    let lastError: Error | null = null;
    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      try {
        const raw = await this.completeAnthropic(
          endpoint,
          CBETA_REWRITE_SYSTEM,
          `${historyBlock}User question:\n${q}\n\nJSON:`,
          this.cbetaRewriteMaxTokens(),
          timeoutMs,
        );
        const parsed = parseCbetaRewriteJson(raw);
        if (parsed?.searchZh) {
          const r = finalize(parsed.searchZh, parsed.keywords, false);
          cache.set(cacheKey, r);
          return r;
        }
        lastError = new Error('CBETA rewrite: empty search_zh');
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `CBETA rewrite failed [${endpoint.provider} model=${endpoint.model} timeoutMs=${timeoutMs}]: ${lastError.message}`,
        );
        if (i >= endpoints.length - 1) break;
      }
    }
    this.logger.warn(
      `CBETA rewrite fallback to original question (bge-m3/FTS still run): ${lastError?.message || 'unknown'}`,
    );
    const r = finalize(q, extractCjkTerms(q), true, 'rewrite_failed');
    cache.set(cacheKey, r);
    return r;
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
    const brief = isCbetaBriefQuestion(question);
    const context = contextBlocks.join('\n\n---\n\n');
    const intentBlock = intentBrief.trim()
      ? `\nPhạm vi / router CBETA:\n${intentBrief.trim()}\n`
      : '';
    const briefRules = brief
      ? `
CHẾ ĐỘ TÓM GỌN (bắt buộc vì người dùng xin tóm gọn / yếu chỉ / đại ý / 簡要):
- PHẦN 1: tối đa khoảng 8–12 câu đúng ngôn ngữ câu hỏi; nêu đúng cốt lõi (vd. một kệ / một công thức), không dàn trải nhiều kinh.
- PHẦN 2 (${AI_INTERPRETATION_MARKER}): 2–3 câu thôi, cùng ngôn ngữ.
- Ưu tiên một luận điểm chính khớp ngữ cảnh; bỏ liệt kê dài.
`
      : '';
    const answerLang = detectCbetaAnswerLang(question);
    const coverageList = isCbetaCoverageIntent(question);
    const assistantPrefill = cbetaAnswerPrefill(answerLang, coverageList);
    const baseUser = `OUTPUT LANGUAGE LOCK: ANSWER_LANG=${answerLang} is absolute from the first continuation token after the assistant prefill. ANSWER_LANG=vi → Vietnamese prose only from the first token (FORBIDDEN: English "the doctrinal…", "I'm…", "I need…", "Người dùng hỏi…", "Tôi cần…"). ANSWER_LANG=zh → Chinese only. ANSWER_LANG=en → English only — FORBIDDEN any Vietnamese diacritics or labels (Giáo môn, Tổ Sư Thiền…); write "doctrinal school" / "patriarch Chan" instead. Continue the article immediately — no planning / "synthesis section" / "AI interpretation section" / "English answer with two parts" / "first a synthesis" scaffolding.
Câu hỏi: ${question.trim()}
${intentBlock}${briefRules}
Ngữ cảnh: mỗi block [CBETA] là nguyên văn Hán (+ meta Trích dẫn / work_code / url). Có thể có [CBETA_ENTITY_LIST]. Các block thường trùng ý — hãy đọc hết rồi gộp.
1) CHỈ dùng corpus CBETA trong ngữ cảnh — không dùng sách Việt tosuthien / Duy Lực.
2) PHẦN 1: tổng hợp / dịch nghĩa từ Hán thành một bài mạch lạc đúng ANSWER_LANG; loại trùng; CẤM chuỗi trích đoạn "…" kèm nguồn trong thân bài (nguồn ở UI cuối). Nếu có ENTITY_LIST: liệt kê tên Việt (kèm Hán) theo list — không viết English planning.
3) Dòng ${AI_INTERPRETATION_MARKER} rồi ghi chú ngắn cùng ANSWER_LANG (không lặp phần 1).
${context}`;
    const strictRetryExtra = `
STRICT RETRY: Previous draft failed the language/quality gate. Write ONLY answer prose in ANSWER_LANG=${answerLang}. First sentence must be content (definition / list), never meta about sections, language, or the user question.`;

    const prior = normalizeHistory(history);
    let lastError: Error | null = null;
    const maxTokens = this.cbetaChatMaxTokens(brief);
    const chatTimeoutMs = this.cbetaChatTimeoutMs();

    // Up to 2 prompt attempts × N endpoints (HHTECH keys round-robin).
    // Do not yield until head passes gate so a bad CoT draft can be discarded.
    for (let attempt = 0; attempt < 2; attempt++) {
      const userContent =
        attempt === 0 ? baseUser : `${baseUser}${strictRetryExtra}`;
      // Fresh rotation each attempt so retries don't stick on a spent key.
      const endpoints = this.ai.orderedChatEndpoints();
      for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];
        try {
          let headBuf = '';
          let headFlushed = false;
          let yielded = false;
          for await (const delta of this.streamAnthropic(
            endpoint,
            CBETA_SYSTEM,
            prior,
            userContent,
            maxTokens,
            assistantPrefill,
            chatTimeoutMs,
          )) {
            if (!headFlushed) {
              headBuf += delta;
              if (shouldBufferCbetaHead(headBuf, answerLang, coverageList)) {
                continue;
              }
              const cleaned = stripLeadingMetaPlanning(headBuf, answerLang);
              const gate = assertCbetaAnswerLang(
                assistantPrefill + cleaned,
                answerLang,
              );
              if (!gate.ok && headBuf.length < 1100) {
                // Keep buffering a bit more before deciding.
                continue;
              }
              if (!gate.ok) {
                // Head still bad at ceiling — abort this attempt (no UI yield).
                throw new Error(
                  `CBETA quality gate failed (${gate.reason}) [${endpoint.provider}]`,
                );
              }
              headFlushed = true;
              yield assistantPrefill;
              if (cleaned) yield cleaned;
              yielded = true;
              continue;
            }
            if (!yielded) {
              yield assistantPrefill;
              yielded = true;
            }
              yield delta;
          }
          if (!headFlushed && headBuf) {
            const cleaned = stripLeadingMetaPlanning(headBuf, answerLang);
            const gate = assertCbetaAnswerLang(
              assistantPrefill + cleaned,
              answerLang,
            );
            if (!gate.ok) {
              throw new Error(
                `CBETA quality gate failed (${gate.reason}) [${endpoint.provider}]`,
              );
            }
            yield assistantPrefill;
            if (cleaned) yield cleaned;
            yielded = true;
          }
          if (yielded) return;
          lastError = new Error(
            `Claude API empty stream [${endpoint.provider} model=${endpoint.model}]`,
          );
          this.logger.warn(lastError.message);
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err));
          const hasEndpointFallback = i < endpoints.length - 1;
          const willRetryPrompt = attempt === 0;
          this.logger.warn(
            `${lastError.message}${
              hasEndpointFallback
                ? ' — trying fallback endpoint'
                : willRetryPrompt
                  ? ' — strict retry'
                  : ''
            }`,
          );
          if (hasEndpointFallback) continue;
          break;
        }
      }
    }

    throw lastError ?? new Error('Claude API: no chat endpoints configured');
  }

  private async completeAnthropic(
    endpoint: ChatEndpoint,
    system: string,
    userContent: string,
    maxTokens: number,
    timeoutMs?: number,
  ): Promise<string> {
    const url = resolveAnthropicMessagesUrl(endpoint.baseUrl);
    const ac = new AbortController();
    const ms =
      typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : undefined;
    const timer = ms
      ? setTimeout(() => ac.abort(), ms)
      : undefined;
    let res: Response;
    try {
      res = await fetch(url, {
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
        signal: ac.signal,
      });
    } catch (err: unknown) {
      if (ac.signal.aborted) {
        throw new Error(
          `Claude API timeout after ${ms}ms [${endpoint.provider} model=${endpoint.model}]`,
        );
      }
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      if (timer) clearTimeout(timer);
    }
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
    assistantPrefill?: string,
    timeoutMs?: number,
  ): AsyncGenerator<string> {
    const url = resolveAnthropicMessagesUrl(endpoint.baseUrl);

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...prior.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userContent },
    ];
    if (assistantPrefill?.trim()) {
      messages.push({
        role: 'assistant',
        content: assistantPrefill,
      });
    }

    const ac = new AbortController();
    const ms =
      typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : undefined;
    const timer = ms
      ? setTimeout(() => ac.abort(), ms)
      : undefined;

    let res: Response;
    try {
      res = await fetch(url, {
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
        signal: ac.signal,
      });
    } catch (err: unknown) {
      if (timer) clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `Claude API stream timeout after ${ms}ms [${endpoint.provider} model=${endpoint.model}]`,
        );
      }
      throw err;
    }

    try {
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
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
