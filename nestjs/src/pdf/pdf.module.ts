import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController, ReadingProgressController } from './pdf.controller';
import { PublicUrlService } from '../common/public-url.service';

@Module({
  controllers: [PdfController, ReadingProgressController],
  providers: [PdfService, PublicUrlService],
  exports: [PdfService, PublicUrlService],
})
export class PdfModule {}
