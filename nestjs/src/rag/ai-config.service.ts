import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ChatProvider = 'shopaikey' | 'nexus' | 'hhtech' | 'flare';

export interface ChatEndpoint {
  provider: ChatProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AiConfig {
  embeddingApiKey: string;
  embeddingBaseUrl: string;
  embeddingModel: string;
  embeddingDim: number;
  chatApiKey: string;
  chatBaseUrl: string;
  chatModel: string;
  chatProvider: ChatProvider;
  /** Ordered chat targets: primary first, then fallback(s). */
  chatEndpoints: ChatEndpoint[];
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

    const provider = (
      this.config.get<string>('CHAT_PROVIDER') || 'shopaikey'
    ).toLowerCase() as ChatProvider;
    const defaultModel =
      this.config.get<string>('CHAT_MODEL') || 'claude-sonnet-4-6';

    const primary = this.resolveEndpoint(provider, defaultModel, shopKey, shopBase);
    const endpoints: ChatEndpoint[] = [primary];

    const fallbackRaw = (
      this.config.get<string>('CHAT_FALLBACK_PROVIDER') || ''
    )
      .toLowerCase()
      .trim();
    if (
      fallbackRaw &&
      fallbackRaw !== primary.provider &&
      this.isChatProvider(fallbackRaw)
    ) {
      try {
        endpoints.push(
          this.resolveEndpoint(
            fallbackRaw,
            defaultModel,
            shopKey,
            shopBase,
          ),
        );
      } catch {
        // Missing fallback credentials — keep primary only.
      }
    }

    this.cached = {
      embeddingApiKey: embedKey,
      embeddingBaseUrl: embedBase.replace(/\/$/, ''),
      embeddingModel:
        this.config.get<string>('EMBEDDING_MODEL') ||
        'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      embeddingDim: parseInt(
        this.config.get<string>('EMBEDDING_DIM') || '384',
        10,
      ),
      chatApiKey: primary.apiKey,
      chatBaseUrl: primary.baseUrl,
      chatModel: primary.model,
      chatProvider: primary.provider,
      chatEndpoints: endpoints,
    };

    return this.cached;
  }

  private isChatProvider(value: string): value is ChatProvider {
    return (
      value === 'shopaikey' ||
      value === 'nexus' ||
      value === 'hhtech' ||
      value === 'flare'
    );
  }

  private resolveEndpoint(
    provider: ChatProvider,
    defaultModel: string,
    shopKey: string,
    shopBase: string,
  ): ChatEndpoint {
    if (provider === 'hhtech') {
      const apiKey = this.config.get<string>('HHTECH_API_KEY') ?? '';
      const baseUrl = (
        this.config.get<string>('HHTECH_BASE_URL') || 'https://hhtechapi.com/v1'
      ).replace(/\/$/, '');
      const model =
        this.config.get<string>('HHTECH_CHAT_MODEL') ||
        this.config.get<string>('ANTHROPIC_MODEL') ||
        defaultModel;
      if (!apiKey) {
        throw new ServiceUnavailableException(
          'CHAT_PROVIDER=hhtech nhưng thiếu HHTECH_API_KEY trong .env',
        );
      }
      return { provider, apiKey, baseUrl, model };
    }

    if (provider === 'nexus') {
      const apiKey = this.config.get<string>('NEXUS_API_KEY') ?? '';
      const baseUrl = (
        this.config.get<string>('NEXUS_BASE_URL') ||
        'https://nexusmmo.store/api/v1'
      ).replace(/\/$/, '');
      const model =
        this.config.get<string>('NEXUS_CHAT_MODEL') ||
        this.config.get<string>('ANTHROPIC_MODEL') ||
        defaultModel;
      if (!apiKey) {
        throw new ServiceUnavailableException(
          'CHAT_PROVIDER=nexus nhưng thiếu NEXUS_API_KEY trong .env',
        );
      }
      return { provider, apiKey, baseUrl, model };
    }

    if (provider === 'flare') {
      const apiKey =
        this.config.get<string>('FLARE_API_KEY') ||
        this.config.get<string>('NINEFLARE_API_KEY') ||
        '';
      const baseUrl = (
        this.config.get<string>('FLARE_BASE_URL') ||
        this.config.get<string>('NINEFLARE_BASE_URL') ||
        'https://9flare.com/api/v1'
      ).replace(/\/$/, '');
      const model =
        this.config.get<string>('FLARE_CHAT_MODEL') ||
        this.config.get<string>('NINEFLARE_CHAT_MODEL') ||
        defaultModel;
      if (!apiKey) {
        throw new ServiceUnavailableException(
          'CHAT_PROVIDER=flare nhưng thiếu FLARE_API_KEY trong .env',
        );
      }
      return { provider, apiKey, baseUrl, model };
    }

    if (!shopKey) {
      throw new ServiceUnavailableException(
        'Thiếu SHOPAIKEY_API_KEY trong .env',
      );
    }
    return {
      provider: 'shopaikey',
      apiKey: shopKey,
      baseUrl: shopBase,
      model: defaultModel,
    };
  }
}
