import { Injectable, Logger } from '@nestjs/common';
import {
  AiConfigService,
  ChatEndpoint,
  resolveAnthropicMessagesUrl,
} from './ai-config.service';
import { AnswerStyle, AnswerStyleContext } from './rag-answer-style';

const BASE_RULES = `Bạn là trợ lý tra cứu lời dạy Hoà thượng Thích Duy Lực về Tổ Sư Thiền. Đây là ứng dụng tra cứu kinh sách hợp pháp.

Quy tắc chung (bắt buộc):
- CHỈ dùng nguyên văn trong các block [Nguồn N]. CẤM bịa thêm kiến thức Phật học/Thiền học ngoài block.
- CẤM giải thích / định nghĩa / diễn giải bằng lời của bạn. Không tóm tắt ý bằng lời AI.
- KHÔNG chào hỏi, KHÔNG tự giới thiệu, KHÔNG lặp lại câu hỏi, KHÔNG bình luận meta về block.
- Câu trả lời = nhiều đoạn NGUYÊN VĂN trong NGOẶC KÉP + nguồn ngay sau mỗi đoạn. Ngoài ngoặc kép chỉ được vài từ nối ngắn (hoặc không có).
- Trong ngoặc kép: COPY nguyên văn — không paraphrase, không đổi chữ.
- Trích ĐỦ Ý và ĐỦ DÀI: lấy cả đoạn / cả cụm đoạn liên tục / cả cặp HỎI–ĐÁP đến hết ý. CẤM cắt giữa câu, cắt nửa ĐÁP, hoặc kết thúc bằng "…" giữa chừng.
- Khi block có [Trang N] (trang trước–trang hit–trang sau): ưu tiên lấy đoạn liên quan trải đủ các trang đó nếu cùng một ý.
- Mỗi đoạn trích phải có nguồn: — (Tên kinh, tr.X) hoặc — (Tên kinh, tr.A–B).
- Ưu tiên NHIỀU nguồn liên quan (nếu có). Đừng trả lời chỉ 1 đoạn ngắn khi còn đoạn khác cùng trả lời trực tiếp.
- ĐA DẠNG NGUỒN: nếu ngữ cảnh có từ 3 block/sách khác nhau trở lên thì phải trích ít nhất 3 nguồn khác nhau (tên kinh hoặc file nguồn khác nhau). Mỗi nguồn một cụm nguyên văn đầy đủ, không lặp cùng một đoạn.
- Ưu tiên góc nhìn / đoạn khác nhau giữa các kinh (không chỉ lấy nhiều đoạn từ cùng một trang).
- Không bullet, không "tóm lại".
- Nếu không có block nào đủ: chỉ một câu — "Trong tư liệu hiện có chưa thấy nội dung này."`;

function buildKinhLongRules(): string {
  return `
Chế độ KINH (block gắn nhãn KINH) — trả lời DÀI + ĐA DẠNG bằng nguyên văn:
- VÀO THẲNG bằng nguyên văn trong ngoặc kép từ block KINH.
- Ưu tiên [KINH]; chỉ dùng [NGỮ LỤC] khi bổ sung trực tiếp.
- Mỗi block KINH liên quan: trích 2–5 đoạn hoàn chỉnh liên tục (hoặc cả chuỗi HỎI–ĐÁP). Không cắt nửa ĐÁP.
- Bắt buộc dùng nhiều sách khác nhau khi có sẵn: tối thiểu 3 nguồn khác nhau nếu ngữ cảnh đủ 3+.
- Độ dài chủ yếu là nguyên văn dài; không thêm lời AI.`;
}

function buildMixedRules(): string {
  return `
Chế độ HỖN HỢP — nguyên văn DÀI + ĐA DẠNG:
- [KINH]: 2–4 đoạn hoàn chỉnh từ nhiều kinh khác nhau nếu có.
- [NGỮ LỤC]: 1–2 đoạn hoàn chỉnh khi trả lời trực tiếp (có thể thêm góc nhìn khác với KINH).
- Ghép các đoạn trích từ nhiều nguồn; không xen lời giải của AI.`;
}

function buildBriefRules(): string {
  return `
Chế độ NGẮN hơn (chủ yếu NGỮ LỤC / liên quan vừa):
- Lấy 2–4 đoạn hoàn chỉnh nguyên văn từ càng nhiều nguồn khác nhau càng tốt + nguồn sau mỗi đoạn.
- Không viết thêm lời AI. Không cắt giữa chừng.
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
  // Room for multi-paragraph verbatim quotes from ±1 page windows.
  switch (style) {
    case 'kinh_long':
      return 4096;
    case 'mixed':
      return 3072;
    case 'brief':
      return 1536;
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
