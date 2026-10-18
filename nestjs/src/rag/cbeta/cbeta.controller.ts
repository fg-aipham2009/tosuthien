import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ChatHistoryMessageDto } from '../../dto';
import { CbetaChatService } from './cbeta-chat.service';
import { CbetaDbService } from './cbeta-db.service';
import { CbetaEntitiesService } from './cbeta-entities.service';
import type { ChatOptions, ChatStreamEvent } from '../rag.types';

/** Dedicated CBETA chat body — never mixed with Duy Lực book RAG. */
export class CbetaChatDto {
  @IsString()
  question!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  topK?: number;

  /** Optional hard filter: CBETA collection codes (T, X, XY, LQ, …). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  collections?: string[];

  /** Force retrieve path; omit = router (fast vs deep/coverage). */
  @IsOptional()
  @IsIn(['fast', 'deep'])
  path?: 'fast' | 'deep';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryMessageDto)
  messages?: ChatHistoryMessageDto[];
}

@Controller('cbeta')
export class CbetaController {
  constructor(
    private readonly cbetaChat: CbetaChatService,
    private readonly cbetaDb: CbetaDbService,
    private readonly entities: CbetaEntitiesService,
  ) {}

  /** DB readiness + corpus size (no LLM). */
  @Get('health')
  async health() {
    if (!this.cbetaDb.isConfigured()) {
      return { ok: false, configured: false };
    }
    try {
      const rows = await this.cbetaDb.query<{
        works: string;
        chunks: string;
        embeddings: string;
      }>(`
        SELECT
          (SELECT count(*)::text FROM works) AS works,
          (SELECT count(*)::text FROM chunks) AS chunks,
          (SELECT count(*)::text FROM chunk_embeddings) AS embeddings
      `);
      const r = rows[0];
      return {
        ok: true,
        configured: true,
        works: Number(r?.works || 0),
        chunks: Number(r?.chunks || 0),
        embeddings: Number(r?.embeddings || 0),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, configured: true, error: message };
    }
  }

  @Get('collections')
  async collections() {
    const rows = await this.cbetaDb.query<{
      code: string;
      name_zh: string;
      name_vi: string;
      works: string;
    }>(`
      SELECT c.code, c.name_zh, c.name_vi, count(w.work_code)::text AS works
      FROM collections c
      LEFT JOIN works w ON w.collection = c.code
      GROUP BY c.code, c.name_zh, c.name_vi, c.sort_order
      ORDER BY c.sort_order, c.code
    `);
    return rows.map((r) => ({
      code: r.code,
      nameZh: r.name_zh,
      nameVi: r.name_vi,
      works: Number(r.works) || 0,
    }));
  }

  @Get('entities')
  async listEntities() {
    return this.entities.listAggregated();
  }

  /** Preview fast/deep routing for a CBETA question (no LLM). */
  @Post('route')
  @HttpCode(HttpStatus.OK)
  async route(@Body() dto: CbetaChatDto) {
    return this.cbetaChat.route(dto.question, this.toOptions(dto));
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@Body() dto: CbetaChatDto) {
    return this.cbetaChat.chat(dto.question, this.toOptions(dto));
  }

  @Post('chat/stream')
  @HttpCode(HttpStatus.OK)
  async chatStream(
    @Body() dto: CbetaChatDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const options = this.toOptions(dto);
    this.cbetaChat.assertCanChat(dto.question);

    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.socket?.setNoDelay(true);
    res.flushHeaders();

    const flush = () => {
      const r = res as Response & { flush?: () => void };
      if (typeof r.flush === 'function') r.flush();
    };

    const waitDrain = () =>
      new Promise<void>((resolve) => {
        if (res.writableEnded || res.destroyed) {
          resolve();
          return;
        }
        res.once('drain', () => resolve());
        setTimeout(resolve, 15_000);
      });

    const write = async (payload: object) => {
      if (res.writableEnded || res.destroyed) return;
      const type =
        'type' in payload &&
        typeof (payload as { type?: unknown }).type === 'string'
          ? (payload as { type: string }).type
          : 'message';
      const frame = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
      const ok = res.write(frame);
      flush();
      if (!ok) await waitDrain();
    };

    const heartbeat = setInterval(() => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`: keepalive ${Date.now()}\n\n`);
      flush();
    }, 15_000);

    try {
      const stream: AsyncGenerator<ChatStreamEvent> = this.cbetaChat.chatStream(
        dto.question,
        options,
      );
      for await (const event of stream) {
        await write(event);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        await write({ type: 'error', message });
      } catch {
        // Client already gone.
      }
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  }

  private toOptions(dto: CbetaChatDto): ChatOptions {
    return {
      topK: dto.topK,
      // Dedicated CBETA API — never route to books.
      corpus: 'cbeta',
      cbetaCollections: dto.collections,
      cbetaPath: dto.path,
      messages: dto.messages?.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
  }
}
