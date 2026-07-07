import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PdfModule } from '../pdf/pdf.module';
import { CentersModule } from '../centers/centers.module';
import { MediaModule } from '../media/media.module';
import { PublicUrlService } from '../common/public-url.service';

@Module({
  imports: [PdfModule, CentersModule, MediaModule],
  controllers: [UploadController],
  providers: [UploadService, PublicUrlService],
})
export class UploadModule {}
