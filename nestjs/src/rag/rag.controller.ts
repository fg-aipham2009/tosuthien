import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import { ChatDto } from '../dto';
import type { ChatOptions } from './rag.types';

@Controller('rag')
export class RagController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
  ) {}

  @Get('sources')
  findAll() {
    return this.prisma.ragSource.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  /** Chat answer — action POST, not resource create → 200 (not Nest default 201). */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@Body() dto: ChatDto) {
    return this.chatService.chat(dto.question, this.toOptions(dto));
  }

  @Post('chat/stream')
  @HttpCode(HttpStatus.OK)
  async chatStream(
    @Body() dto: ChatDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    // Fail fast with real HTTP status (400/503) before SSE headers commit.
    this.chatService.assertCanChat(dto.question);

    // POST defaults to 201 — force 200 before headers flush for reliable SSE.
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // Disable Nagle so small SSE frames leave the socket immediately.
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
        // Safety: never hang forever if drain never fires.
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
      // Large `done` frames can fill the socket buffer; ending before drain
      // truncates Transfer-Encoding: chunked → ERR_INCOMPLETE_CHUNKED_ENCODING.
      if (!ok) await waitDrain();
    };

    // Keep proxies/browsers from closing idle sockets while we build citations.
    const heartbeat = setInterval(() => {
      if (res.writableEnded || res.destroyed) return;
      res.write(`: keepalive ${Date.now()}\n\n`);
      flush();
    }, 15_000);

    try {
      for await (const event of this.chatService.chatStream(
        dto.question,
        this.toOptions(dto),
      )) {
        await write(event);
      }
    } catch (err: unknown) {
      // Headers already sent — surface as SSE error event (cannot change status).
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

  private toOptions(dto: ChatDto): ChatOptions {
    return {
      topK: dto.topK,
      sourceFiles: dto.sourceFiles,
      messages: dto.messages?.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };
  }
}
