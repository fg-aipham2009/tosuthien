import { Controller, Get, Post, Body, Res } from '@nestjs/common';
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

  @Post('chat')
  chat(@Body() dto: ChatDto) {
    return this.chatService.chat(dto.question, this.toOptions(dto));
  }

  @Post('chat/stream')
  async chatStream(@Body() dto: ChatDto, @Res() res: Response) {
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

    const write = (payload: object) => {
      const type =
        'type' in payload && typeof (payload as { type?: unknown }).type === 'string'
          ? (payload as { type: string }).type
          : 'message';
      res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
      flush();
    };

    try {
      for await (const event of this.chatService.chatStream(
        dto.question,
        this.toOptions(dto),
      )) {
        write(event);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      write({ type: 'error', message });
    } finally {
      res.end();
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
