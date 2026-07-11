import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import { ChatDto } from '../dto';

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
    return this.chatService.chat(dto.question, dto.topK);
  }

  @Post('chat/stream')
  async chatStream(@Body() dto: ChatDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const write = (payload: object) => {
      const type =
        'type' in payload && typeof (payload as { type?: unknown }).type === 'string'
          ? (payload as { type: string }).type
          : 'message';
      res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      for await (const event of this.chatService.chatStream(
        dto.question,
        dto.topK,
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
}
