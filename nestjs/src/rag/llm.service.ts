import { Injectable, Logger } from '@nestjs/common';
import {
  AiConfigService,
  ChatEndpoint,
  resolveAnthropicMessagesUrl,
} from './ai-config.service';
import { AnswerStyle, AnswerStyleContext } from './rag-answer-style';

const BASE_RULES = `Bạn là trợ lý tra cứu lời dạy Hoà thượng Thích Duy Lực về Tổ Sư Thiền. Đây là ứng dụng tra cứu kinh sách hợp pháp.

Quy tắc chung (bắt buộc):
- CHỈ được dùng nguyên văn trong các block [Nguồn N]. CẤM dùng kiến thức Phật học/Thiền học ngoài block.
- CẤM tự viết thêm: không giải thích, không định nghĩa, không diễn giải, không tóm tắt, không bình luận bằng lời của bạn.
- KHÔNG tự giới thiệu, KHÔNG chào hỏi, KHÔNG lặp lại câu hỏi.
- CẤM bình luận meta về block ("Trong block không có...", "Block chỉ nhắc..."). Block không khớp → bỏ qua im lặng.
- Toàn bộ câu trả lời gần như chỉ là các đoạn trong NGOẶC KÉP + dòng nguồn ngay sau. Ngoài ngoặc kép: tối đa 0–5 từ nối (hoặc không có chữ nào).
- Trong ngoặc kép phải COPY NGUYÊN VĂN từ đúng block — không paraphrase, không đổi chữ, không rút gọn giữa câu.
- Trích ĐOẠN ĐỦ Ý: lấy cả đoạn văn / cả cặp HỎI–ĐÁP liên tục đến hết ý. CẤM cắt giữa câu, cắt nửa đoạn, cắt giữa ĐÁP, hoặc kết thúc bằng "…" giữa chừng.
- Nếu ý bắt đầu ở trang trước hoặc kéo sang trang sau trong cùng block (có [Trang N]): vẫn lấy đủ đoạn liên tục, ghi nguồn tr.A–B khi block cho khoảng trang.
- Mỗi đoạn trích phải có nguồn ngay sau: — (Tên kinh, tr.X) hoặc — (Tên kinh, tr.A–B).
- Ưu tiên nhiều nguồn liên quan nếu có; tránh chỉ 1 nguồn khi còn nguồn khác trả lời trực tiếp.
- Không bullet, không "tóm lại", không liệt kê ý bằng lời AI.
- Nếu không có block nào đủ trả lời: chỉ một câu — "Trong tư liệu hiện có chưa thấy nội dung này." — không thêm gì nữa.`;

function buildKinhLongRules(): string {
  return `
Chế độ KINH (block gắn nhãn KINH):
- VÀO THẲNG bằng nguyên văn trong ngoặc kép từ block KINH.
- Ưu tiên [KINH]; bỏ [NGỮ LỤC] nếu không bổ sung trực tiếp.
- Mỗi block KINH liên quan: 1–3 đoạn hoàn chỉnh liên tục trong ngoặc kép; Hỏi–Đáp lấy cả cặp, không cắt nửa ĐÁP.
- Phần lớn nội dung là nguyên văn; không thêm lời AI.`;
}

function buildMixedRules(): string {
  return `
Chế độ HỖN HỢP:
- [KINH]: trích 1–3 đoạn hoàn chỉnh nguyên văn — phần chính.
- [NGỮ LỤC]: chỉ khi trả lời trực tiếp — tối đa 1 đoạn hoàn chỉnh (hoặc cả cặp HỎI–ĐÁP).
- Không viết thêm lời giải bằng AI giữa các đoạn trích.`;
}

function buildBriefRules(): string {
  return `
Chế độ NGẮN (chỉ NGỮ LỤC hoặc liên quan yếu):
- Tối đa 1–2 đoạn hoàn chỉnh nguyên văn trong ngoặc kép + nguồn.
- Không thêm lời AI. Không cắt giữa câu.
- Không khớp: "Trong tư liệu hiện có chưa thấy nội dung này."`;
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
  // Allow full paragraphs from ±1 page windows without mid-cut pressure.
  switch (style) {
    case 'kinh_long':
      return 3072;
    case 'mixed':
      return 2048;
    case 'brief':
      return 1024;
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
  ): Promise<string> {
    const parts: string[] = [];
    for await (const delta of this.answerStream(
      question,
      contextBlocks,
      styleContext,
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
  ): AsyncGenerator<string> {
    const context = contextBlocks.join('\n\n---\n\n');
    const system = buildSystemPrompt(styleContext);
    const userContent = `Câu hỏi: ${question.trim()}

Ngữ cảnh (mỗi block có [Nguồn N | KINH hoặc NGỮ LỤC] — chỉ trích từ block liên quan; bỏ block không liên quan, không giải thích vì sao bỏ):
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

        let event: ClaudeStreamEvent;
        try {
          event = JSON.parse(payload) as ClaudeStreamEvent;
        } catch {
          continue;
        }

        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta' &&
          event.delta.text
        ) {
          yield event.delta.text;
        }
      }
    }
  }
}
