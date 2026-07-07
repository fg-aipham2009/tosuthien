import { Controller, Get, Post, Body } from '@nestjs/common';
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
}
