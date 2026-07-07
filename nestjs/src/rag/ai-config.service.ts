import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ChatProvider = 'shopaikey' | 'nexus';

export interface AiConfig {
  embeddingApiKey: string;
  embeddingBaseUrl: string;
  embeddingModel: string;
  embeddingDim: number;
  chatApiKey: string;
  chatBaseUrl: string;
  chatModel: string;
  chatProvider: ChatProvider;
}

/** Anthropic-compatible POST .../v1/messages */
export function resolveAnthropicMessagesUrl(chatBaseUrl: string): string {
  const base = chatBaseUrl.replace(/\/$/, '');
  if (base.endsWith('/v1')) return `${base}/messages`;
  return `${base}/v1/messages`;
}

@Injectable()
export class AiConfigService {
  private cached: AiConfig | null = null;

  constructor(private readonly config: ConfigService) {}

  get(): AiConfig {
    if (this.cached) return this.cached;

    const shopKey = this.config.get<string>('SHOPAIKEY_API_KEY') ?? '';
    const embedKey =
      this.config.get<string>('EMBEDDING_API_KEY') ||
      this.config.get<string>('OPENAI_API_KEY') ||
      shopKey;

    const shopBase = (
      this.config.get<string>('SHOPAIKEY_BASE_URL') || 'https://api.shopaikey.com'
    ).replace(/\/$/, '');

    const embedBase =
      this.config.get<string>('EMBEDDING_BASE_URL') ||
      this.config.get<string>('OPENAI_BASE_URL') ||
      (embedKey !== shopKey ? `${shopBase}/v1` : 'https://api.openai.com/v1');

    const provider = (this.config.get<string>('CHAT_PROVIDER') || 'shopaikey').toLowerCase() as ChatProvider;
    const defaultModel = this.config.get<string>('CHAT_MODEL') || 'claude-opus-4-8';

    let chatApiKey: string;
    let chatBaseUrl: string;
    let chatModel: string;

    if (provider === 'nexus') {
      chatApiKey = this.config.get<string>('NEXUS_API_KEY') ?? '';
      chatBaseUrl = (
        this.config.get<string>('NEXUS_BASE_URL') || 'https://nexusmmo.store/api/v1'
      ).replace(/\/$/, '');
      chatModel =
        this.config.get<string>('NEXUS_CHAT_MODEL') ||
        this.config.get<string>('ANTHROPIC_MODEL') ||
        defaultModel;

      if (!chatApiKey) {
        throw new ServiceUnavailableException(
          'CHAT_PROVIDER=nexus nhưng thiếu NEXUS_API_KEY trong .env',
        );
      }
    } else {
      if (!shopKey) {
        throw new ServiceUnavailableException(
          'Thiếu SHOPAIKEY_API_KEY trong .env',
        );
      }
      chatApiKey = shopKey;
      chatBaseUrl = shopBase;
      chatModel = defaultModel;
    }

    this.cached = {
      embeddingApiKey: embedKey,
      embeddingBaseUrl: embedBase.replace(/\/$/, ''),
      embeddingModel:
        this.config.get<string>('EMBEDDING_MODEL') ||
        'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      embeddingDim: parseInt(this.config.get<string>('EMBEDDING_DIM') || '384', 10),
      chatApiKey,
      chatBaseUrl,
      chatModel,
      chatProvider: provider === 'nexus' ? 'nexus' : 'shopaikey',
    };

    return this.cached;
  }
}
