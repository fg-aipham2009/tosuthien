import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { AiConfigService } from './ai-config.service';
import { EmbeddingService } from './embedding.service';
import { LlmService } from './llm.service';
import { ChatService } from './chat.service';
import { CitationLinkService } from './citation-link.service';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [PdfModule],
  controllers: [RagController],
  providers: [
    AiConfigService,
    EmbeddingService,
    LlmService,
    ChatService,
    CitationLinkService,
  ],
})
export class RagModule {}
