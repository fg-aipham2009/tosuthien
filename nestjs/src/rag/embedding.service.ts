import { Injectable } from '@nestjs/common';
import { AiConfigService } from './ai-config.service';

const MAX_INPUT_CHARS = 12_000;

@Injectable()
export class EmbeddingService {
  constructor(private readonly ai: AiConfigService) {}

  async embed(text: string): Promise<number[]> {
    const input = text.trim().slice(0, MAX_INPUT_CHARS);
    const { embeddingBaseUrl, embeddingApiKey, embeddingModel, embeddingDim } = this.ai.get();

    const res = await fetch(`${embeddingBaseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${embeddingApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: embeddingModel,
        input,
        dimensions: embeddingDim,
        // Local e5 server needs this to add the "query:" prefix; OpenAI ignores it.
        input_type: 'query',
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      throw new Error(`Embedding API ${res.status}: ${detail}`);
    }

    const data = (await res.json()) as { data: { embedding: number[] }[] };
    const vector = data.data[0]?.embedding;
    if (!vector?.length) throw new Error('Embedding API trả về rỗng');
    if (vector.length !== embeddingDim) {
      throw new Error(`Vector dim ${vector.length} != ${embeddingDim}`);
    }
    return vector;
  }

  toVectorLiteral(values: number[]): string {
    return `[${values.map((v) => v.toFixed(8)).join(',')}]`;
  }
}
