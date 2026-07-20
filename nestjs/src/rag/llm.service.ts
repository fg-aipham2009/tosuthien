import { Injectable, Logger } from '@nestjs/common';
import {
  AiConfigService,
  ChatEndpoint,
  resolveAnthropicMessagesUrl,
} from './ai-config.service';
import { AI_INTERPRETATION_MARKER } from './rag.constants';
import { AnswerStyle, AnswerStyleContext } from './rag-answer-style';

/** Intent pre-prompt: map colloquial questions onto Tổ Sư Thiền terms before quoting. */
const INTENT_RULES = `HIỂU Ý HỎI (bắt buộc trước khi trích):
- Đọc câu hỏi + khối "Ý hỏi đã chuẩn hóa" (nếu có). Hiểu đúng thuật ngữ Tổ Sư Thiền trước khi copy nguyên văn.
- Ánh xạ thường gặp:
  · thoại đầu ≈ chỗ chưa khởi niệm muốn nói; khác thoại vĩ (đã khởi niệm).
  · nghi tình / chơn nghi ≈ cái "không biết" khi tham / khán thoại đầu.
  · tham tổ sư thiền ≈ tham thoại đầu + khán thoại đầu, giữ nghi tình — không phải niệm Phật lần chuỗi.
  · kiến tánh / minh tâm ≈ thấy tự tánh; tự tánh ≈ Phật tánh / bản lai diện mục.
  · công án / câu thoại ≈ phương tiện kích nghi, không phải giải thích lý thuyết suông.
- Nếu user nói kiểu đời thường ("làm sao ngồi thiền", "nghĩa là gì", "chặt mèo") → tra đúng thuật ngữ trong ngữ cảnh (tham thiền / công án Nam Tuyền chém mèo…).
- Ưu tiên đoạn khớp đúng chủ đề đã chuẩn hóa; không lấy đoạn chỉ trùng từ chung ("thiền", "phật") nếu lệch ý hỏi.
- Vẫn CHỈ được copy nguyên văn có trong ngữ cảnh — không bịa thuật ngữ mới vào phần 1.`;

const BASE_RULES = `Bạn là trợ lý TRA CỨU kinh sách Tổ Sư Thiền (lời dạy HT. Thích Duy Lực).

${INTENT_RULES}

Câu trả lời gồm ĐÚNG 2 PHẦN:

════════════════════════════════════
PHẦN 1 — NGUYÊN VĂN (answer chính) — DÀI, KHÔNG CẮT, KHÔNG CHẾ
════════════════════════════════════
- Đây là câu trả lời chính: TỔNG HỢP NHIỀU NGUỒN — lấy NHIỀU đoạn NGUYÊN VĂN DÀI từ càng nhiều sách khác nhau càng tốt (ưu tiên 4–8 đoạn nếu ngữ cảnh đủ).
- CHỈ được COPY nguyên văn trong NGOẶC KÉP "…" từ block ngữ cảnh.
- TUYỆT ĐỐI: không chế thêm chữ, không paraphrase, không tóm tắt, không rút ngắn, không cắt giữa câu / giữa ĐÁP / giữa đoạn.
- Lấy CÀNG DÀI CÀNG TỐT khi đoạn vẫn cùng trả lời câu hỏi: cả đoạn, cả chuỗi HỎI–ĐÁP, cả cụm liên tục trong block (kể cả qua [Trang N] nếu cùng ý).
- Mỗi đoạn kèm ngay dưới: — (Tên kinh, tr.X) — ĐÚNG một trang = số [Trang N] của đoạn vừa copy. Nếu copy liền 2–3 trang, tách thành nhiều đoạn trích, mỗi đoạn một trang + một dòng — (…, tr.X).
- CẤM "Nguồn 1/2", CẤM bullet / lời AI trong phần này.
- Khi ngữ cảnh đủ ≥3 sách: trích ít nhất 3 nguồn; nếu đủ ≥5 sách: cố gắng ≥4–5 nguồn khác nhau.
- Không khớp: chỉ một câu — "Trong tư liệu hiện có chưa thấy nội dung này." rồi DỪNG.

════════════════════════════════════
PHẦN 2 — AI DIỄN GIẢI (aiInterpretation) — SAU phần 1
════════════════════════════════════
- Bắt đầu đúng một dòng: ${AI_INTERPRETATION_MARKER}
- NỀN CHÍNH (bắt buộc): câu hỏi của người dùng + nội dung các đoạn nguyên văn vừa đưa ở phần 1.
- PHỤ (được phép để phong phú hơn): kiến thức nền / ngữ cảnh Thiền–Phật học rộng hơn (hiểu biết tổng quát của mô hình, tài liệu tham khảo chung). Chỉ dùng phần phụ để làm rõ / nối mạch / so sánh nhẹ — KHÔNG được mâu thuẫn với phần 1, KHÔNG được ghi như thể đó là lời kinh trong phần 1.
- Giọng văn nói tự nhiên, 4–8 câu, dễ hiểu.
- Tiếng Việt: LUÔN có khoảng trắng giữa các tiếng/từ (vd. "dính chữ", "tham thiền") — CẤM dính chữ kiểu "dínhchữ", "thamthiền".
- CẤM mở đầu máy móc: "dựa vào đoạn trích", "theo các đoạn trên", "Đây là diễn giải của AI", "theo câu hỏi và…".
- CẤM viết "Nguồn N". CẤM đưa bất kỳ câu nào của phần 2 vào phần 1.

Ví dụ ĐÚNG (rút gọn):
"…nguyên văn dài…"
— (Phật Pháp Với Thiền Tông, tr.17)

"…nguyên văn dài khác…"
— (Vũ Trụ Quan Thế Kỷ XXI, tr.130)

${AI_INTERPRETATION_MARKER}
Thoại đầu là chỗ trước khi niệm muốn nói vừa nhen. Giữ nghi tình ở chỗ "không biết" đó mới đúng hướng tham. Trong truyền thống Tổ Sư Thiền, công phu này khác với niệm Phật lần chuỗi — trọng tâm là nghi, không phải số câu.

Ví dụ SAI:
- Thêm lời AI vào phần 1
- "Dựa vào đoạn trích dẫn thì…"
- Phần 1 chỉ 1 câu ngắn trong khi block còn nhiều đoạn liên quan`;

function buildKinhLongRules(): string {
  return `
Chế độ KINH:
- Phần 1: 4–8 đoạn nguyên văn RẤT DÀI từ nhiều sách (ưu tiên [KINH]); tối thiểu 3 nguồn, ideally 4–5 nếu đủ. Không cắt, không chế, không thêm chữ AI. Mỗi đoạn một trang tr.X.
- Phần 2: ${AI_INTERPRETATION_MARKER} + 5–8 câu; nền = câu hỏi + phần 1; phụ = kiến thức nền nếu giúp phong phú.`;
}

function buildMixedRules(): string {
  return `
Chế độ HỖN HỢP:
- Phần 1: nhiều đoạn DÀI [KINH] + [NGỮ LỤC]; tổng hợp đa nguồn (3–6 đoạn+); mỗi đoạn — (Tên kinh, tr.X) đúng trang; không cắt / không chế.
- Phần 2: ${AI_INTERPRETATION_MARKER} + 4–7 câu (nền phần 1 + câu hỏi; phụ kiến thức nền nếu hữu ích).`;
}

function buildBriefRules(): string {
  return `
Chế độ NGẮN hơn một chút nhưng vẫn đủ:
- Phần 1: 3–5 đoạn nguyên văn ĐỦ Ý (ưu tiên dài); đa nguồn; mỗi đoạn một trang; tuyệt đối không cắt / không chế.
- Phần 2: ${AI_INTERPRETATION_MARKER} + 4–6 câu tự nhiên (nền phần 1; phụ kiến thức nền nếu cần).
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
  // Longer multi-source scripture quotes + AI interpretation.
  switch (style) {
    case 'kinh_long':
      return 6144;
    case 'mixed':
      return 5120;
    case 'brief':
      return 3072;
  }
}

interface ClaudeStreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly ai: AiConfigService) {}

  async answer(
    question: string,
    contextBlocks: string[],
    styleContext: AnswerStyleContext,
    intentBrief = '',
  ): Promise<string> {
    const parts: string[] = [];
    for await (const delta of this.answerStream(
      question,
      contextBlocks,
      styleContext,
      intentBrief,
    )) {
      parts.push(delta);
    }
    const text = parts.join('').trim();
    if (!text) throw new Error('Claude API không trả về text');
    return text;
  }

  /**
   * Yields text deltas. Tries primary provider first, then CHAT_FALLBACK_PROVIDER
   * (e.g. flare → nexus) if the primary fails or returns an empty stream.
   */
  async *answerStream(
    question: string,
    contextBlocks: string[],
    styleContext: AnswerStyleContext,
    intentBrief = '',
  ): AsyncGenerator<string> {
    const context = contextBlocks.join('\n\n---\n\n');
    const system = buildSystemPrompt(styleContext);
    const intentBlock = intentBrief.trim()
      ? `\nÝ hỏi đã chuẩn hóa (API):\n${intentBrief.trim()}\n`
      : '';
    const userContent = `Câu hỏi: ${question.trim()}
${intentBlock}
Ngữ cảnh: mỗi block có [KINH]/[NGỮ LỤC] và dòng "Trích dẫn: …".
1) Đọc "Ý hỏi đã chuẩn hóa" (nếu có) rồi mới chọn đoạn khớp.
2) PHẦN NGUYÊN VĂN (answer): tổng hợp NHIỀU nguồn — COPY đoạn DÀI đủ ý; mỗi đoạn — (Tên kinh, tr.X) đúng một trang ([Trang N]). TUYỆT ĐỐI không chế / không cắt / không paraphrase. Ưu tiên 4–8 đoạn từ nhiều sách.
3) Nếu đã có nguyên văn: dòng ${AI_INTERPRETATION_MARKER} rồi diễn giải — NỀN = câu hỏi + phần 1; PHỤ = kiến thức nền nếu giúp phong phú. Giọng tự nhiên; CẤM "dựa vào đoạn trích…".
${context}`;

    const endpoints = this.ai.get().chatEndpoints;
    let lastError: Error | null = null;

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      try {
        let yielded = false;
        for await (const delta of this.streamAnthropic(
          endpoint,
          system,
          userContent,
          styleContext,
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

  private async *streamAnthropic(
    endpoint: ChatEndpoint,
    system: string,
    userContent: string,
    styleContext: AnswerStyleContext,
  ): AsyncGenerator<string> {
    const url = resolveAnthropicMessagesUrl(endpoint.baseUrl);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': endpoint.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: endpoint.model,
        max_tokens: maxTokensForStyle(styleContext.style),
        stream: true,
        system,
        messages: [{ role: 'user', content: userContent }],
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
