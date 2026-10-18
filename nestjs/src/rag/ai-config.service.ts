import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** CBETA chunk_embeddings + local embed_server.py — never MiniLM 384. */
export const REQUIRED_EMBEDDING_MODEL = 'BAAI/bge-m3';
export const REQUIRED_EMBEDDING_DIM = 1024;

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
  private readonly logger = new Logger(AiConfigService.name);
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
      this.config.get<string>('CHAT_MODEL') || 'claude-opus-5-5';

    const primary = this.resolveEndpoint(provider, defaultModel, shopKey, shopBase);
    const endpoints: ChatEndpoint[] = [primary];

    const fallbackRaw = (
      this.config.get<string>('CHAT_FALLBACK_PROVIDER') ||
      this.config.get<string>('CHAT_FALLBACK_PROVIDERS') ||
      ''
    )
      .toLowerCase()
      .trim();
    const seen = new Set<ChatProvider>([primary.provider]);
    for (const part of fallbackRaw.split(/[,+|]/).map((s) => s.trim())) {
      if (!part || !this.isChatProvider(part) || seen.has(part)) continue;
      try {
        endpoints.push(
          this.resolveEndpoint(part, defaultModel, shopKey, shopBase),
        );
        seen.add(part);
      } catch {
        // Missing fallback credentials — skip.
      }
    }

    const rawModel =
      this.config.get<string>('EMBEDDING_MODEL') || REQUIRED_EMBEDDING_MODEL;
    const rawDim = parseInt(
      this.config.get<string>('EMBEDDING_DIM') || String(REQUIRED_EMBEDDING_DIM),
      10,
    );
    const { model: embeddingModel, dim: embeddingDim } =
      this.normalizeEmbeddingConfig(rawModel, rawDim);

    this.cached = {
      embeddingApiKey: embedKey,
      embeddingBaseUrl: embedBase.replace(/\/$/, ''),
      embeddingModel,
      embeddingDim,
      chatApiKey: primary.apiKey,
      chatBaseUrl: primary.baseUrl,
      chatModel: primary.model,
      chatProvider: primary.provider,
      chatEndpoints: endpoints,
    };

    return this.cached;
  }

  /**
   * Refuse MiniLM/384 (old Duy Lực default). CBETA vectors are BGE-M3 1024-d;
   * a mismatched query embed silently breaks hybrid search.
   */
  private normalizeEmbeddingConfig(
    model: string,
    dim: number,
  ): { model: string; dim: number } {
    const m = (model || '').trim() || REQUIRED_EMBEDDING_MODEL;
    const d = Number.isFinite(dim) && dim > 0 ? dim : REQUIRED_EMBEDDING_DIM;
    const badModel = /minilm|paraphrase-multilingual/i.test(m);
    const badDim = d !== REQUIRED_EMBEDDING_DIM;
    if (badModel || badDim) {
      this.logger.error(
        `Refusing embedding config model=${m} dim=${d}; ` +
          `forcing ${REQUIRED_EMBEDDING_MODEL} / ${REQUIRED_EMBEDDING_DIM} ` +
          `(CBETA chunk_embeddings). Fix host .env — do not set MiniLM/384.`,
      );
      return {
        model: REQUIRED_EMBEDDING_MODEL,
        dim: REQUIRED_EMBEDDING_DIM,
      };
    }
    if (!/bge-m3/i.test(m)) {
      this.logger.warn(
        `EMBEDDING_MODEL=${m} is not BGE-M3; CBETA expects ${REQUIRED_EMBEDDING_MODEL}`,
      );
    }
    return { model: m, dim: d };
  }

  private isChatProvider(value: string): value is ChatProvider {
    return (
      value === 'shopaikey' ||
      value === 'nexus' ||
      value === 'hhtech' ||
      value === 'flare'
    );
  }

  /** Prefer provider-specific CHAT model, then shared CHAT_MODEL. */
  private modelFor(provider: ChatProvider, defaultModel: string): string {
    const specific =
      provider === 'flare'
        ? this.config.get<string>('FLARE_CHAT_MODEL')
        : provider === 'hhtech'
          ? this.config.get<string>('HHTECH_CHAT_MODEL')
          : provider === 'nexus'
            ? this.config.get<string>('NEXUS_CHAT_MODEL')
            : this.config.get<string>('SHOPAIKEY_CHAT_MODEL');
    const trimmed = specific?.trim();
    return trimmed || defaultModel;
  }

  /**
   * Old nexusmmo.store host returns 410 permanently.
   * Always force the current api.nexusmmo.store /v1 endpoint.
   */
  private normalizeNexusBaseUrl(raw: string): string {
    const cleaned = raw.trim().replace(/\/$/, '');
    if (!cleaned) return 'https://api.nexusmmo.store/v1';
    try {
      const u = new URL(cleaned);
      if (
        u.hostname === 'nexusmmo.store' ||
        u.hostname === 'www.nexusmmo.store'
      ) {
        return 'https://api.nexusmmo.store/v1';
      }
    } catch {
      return 'https://api.nexusmmo.store/v1';
    }
    return cleaned;
  }

  private resolveEndpoint(
    provider: ChatProvider,
    defaultModel: string,
    shopKey: string,
    shopBase: string,
  ): ChatEndpoint {
    const model = this.modelFor(provider, defaultModel);

    if (provider === 'hhtech') {
      const apiKey = this.config.get<string>('HHTECH_API_KEY') ?? '';
      const baseUrl = (
        this.config.get<string>('HHTECH_BASE_URL') || 'https://hhtechapi.com/v1'
      ).replace(/\/$/, '');
      if (!apiKey) {
        throw new ServiceUnavailableException(
          'CHAT_PROVIDER=hhtech nhưng thiếu HHTECH_API_KEY trong .env',
        );
      }
      return { provider, apiKey, baseUrl, model };
    }

    if (provider === 'nexus') {
      const apiKey = this.config.get<string>('NEXUS_API_KEY') ?? '';
      const baseUrl = this.normalizeNexusBaseUrl(
        this.config.get<string>('NEXUS_BASE_URL') ||
          'https://api.nexusmmo.store/v1',
      );
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
      model,
    };
  }
}
