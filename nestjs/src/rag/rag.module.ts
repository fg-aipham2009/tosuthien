import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { AiConfigService } from './ai-config.service';
import { EmbeddingService } from './embedding.service';
import { LlmService } from './llm.service';
import { ChatService } from './chat.service';
import { CitationLinkService } from './citation-link.service';
import { CbetaDbService } from './cbeta/cbeta-db.service';
import { CbetaCollectionsService } from './cbeta/cbeta-collections.service';
import { CbetaEntitiesService } from './cbeta/cbeta-entities.service';
import { CbetaRetrieveService } from './cbeta/cbeta-retrieve.service';
import { CbetaChatService } from './cbeta/cbeta-chat.service';
import { CbetaController } from './cbeta/cbeta.controller';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [PdfModule],
  controllers: [RagController, CbetaController],
  providers: [
    AiConfigService,
    EmbeddingService,
    LlmService,
    ChatService,
    CitationLinkService,
    CbetaDbService,
    CbetaCollectionsService,
    CbetaEntitiesService,
    CbetaRetrieveService,
    CbetaChatService,
  ],
})
export class RagModule {}
