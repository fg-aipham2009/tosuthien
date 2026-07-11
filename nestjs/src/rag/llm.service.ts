import { Injectable } from '@nestjs/common';
import { AiConfigService, resolveAnthropicMessagesUrl } from './ai-config.service';
import { AnswerStyle, AnswerStyleContext } from './rag-answer-style';

const BASE_RULES = `Bạn là trợ lý tra cứu lời dạy Hoà thượng Thích Duy Lực về Tổ Sư Thiền. Đây là ứng dụng tra cứu kinh sách hợp pháp.

Quy tắc chung (bắt buộc):
- Chỉ dùng thông tin trong các block [Nguồn N]. KHÔNG dùng kiến thức Phật học/Thiền học phổ biến ngoài block — kể cả công án, điển tích nổi tiếng nếu không có nguyên văn trong block.
- KHÔNG tự giới thiệu, KHÔNG chào hỏi, KHÔNG lặp lại câu hỏi.
- CẤM bình luận meta về block: không viết "Trong block [Nguồn N] không có...", "Block chỉ nhắc sự kiện khác", "Các block không đề cập...". Block không trả lời trực tiếp → bỏ qua im lặng, không nhắc tới block đó.
- NGOÀI ngoặc kép: chỉ câu nối tối đa ~10–20 từ nếu thật sự cần. Không định nghĩa, không suy luận dài bằng lời AI.
- Trong ngoặc kép phải là nguyên văn từ đúng block; không paraphrase; ghi nguồn ngay sau: — (Tên kinh, tr.X) hoặc — (Tên kinh, tr.A–B) nếu block ghi khoảng trang.
- Trích theo ĐOẠN hoàn chỉnh: lấy cả đoạn văn / cả cặp HỎI–ĐÁP liên tục. CẤM cắt giữa câu, cắt nửa đoạn, hoặc kết thúc bằng "…" giữa chừng.
- Mỗi đoạn trích đều phải có nguồn ngay sau đoạn trích. Không để đoạn nào thiếu nguồn.
- Ưu tiên dùng nhiều nguồn liên quan (nếu có), tránh chỉ dùng 1 nguồn duy nhất khi có nguồn khác cùng trả lời trực tiếp.
- Không bullet, không "tóm lại".
- Nếu không có block nào trả lời đủ câu hỏi: chỉ một câu duy nhất — "Trong tư liệu hiện có chưa thấy nội dung này." — không thêm giải thích.`;

function buildKinhLongRules(): string {
  return `
Chế độ KINH (block gắn nhãn KINH):
- VÀO THẲNG bằng trích nguyên văn đầu tiên từ block KINH.
- Ưu tiên block [KINH] trước; bỏ qua block [NGỮ LỤC] nếu không bổ sung trực tiếp.
- Mỗi block KINH liên quan: trích 1–3 đoạn hoàn chỉnh liên tục trong ngoặc kép; Hỏi–Đáp thì lấy cả cặp HỎI + ĐÁP, không cắt nửa câu trả lời.
- Thường 3–6 đoạn; phần lớn nội dung là nguyên văn.
- Nếu ngữ cảnh có từ 3 block phù hợp trở lên thì cố gắng dùng ít nhất 3 block khác nhau.`;
}

function buildMixedRules(): string {
  return `
Chế độ HỖN HỢP:
- Block [KINH]: trích 1–3 đoạn hoàn chỉnh như trên — đây là phần chính của câu trả lời.
- Block [NGỮ LỤC]: chỉ khi trả lời trực tiếp câu hỏi — trích 1 đoạn hoàn chỉnh (hoặc cả cặp HỎI–ĐÁP); tối đa một đoạn phụ. Không cắt nửa câu.
- Tổng câu trả lời: ưu tiên dài ở KINH, phần NGỮ LỤC gọn nhưng vẫn đủ đoạn.
- Cố gắng dùng tối thiểu 2 nguồn khác nhau khi ngữ cảnh có sẵn.`;
}

function buildBriefRules(): string {
  return `
Chế độ NGẮN (chỉ NGỮ LỤC hoặc block liên quan yếu):
- Trả lời NGẮN GỌN: tối đa 1–2 đoạn hoàn chỉnh nguyên văn trong ngoặc kép + nguồn (không cắt giữa câu).
- Không cố kéo dài. Không thêm công án/điển tích ngoài block.
- Nếu có nhiều block cùng trả lời trực tiếp thì ưu tiên 2 đoạn từ 2 nguồn khác nhau.
- Nếu block không khớp câu hỏi: "Trong tư liệu hiện có chưa thấy nội dung này."`;
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
  // Lower caps cut wall-clock time; answers stay quote-heavy but shorter.
  switch (style) {
    case 'kinh_long':
      return 2048;
    case 'mixed':
      return 1280;
    case 'brief':
      return 512;
  }
}

interface ClaudeStreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
}

@Injectable()
export class LlmService {
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

  /** Yields text deltas from Anthropic Messages streaming API. */
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

    const { chatBaseUrl, chatApiKey, chatModel, chatProvider } = this.ai.get();
    const url = resolveAnthropicMessagesUrl(chatBaseUrl);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': chatApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: chatModel,
        max_tokens: maxTokensForStyle(styleContext.style),
        stream: true,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      throw new Error(
        `Claude API ${res.status} [${chatProvider} model=${chatModel} url=${url}]: ${detail}`,
      );
    }

    if (!res.body) {
      throw new Error('Claude API stream: empty body');
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
