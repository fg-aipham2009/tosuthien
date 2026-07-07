import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { PublicUrlService } from '../common/public-url.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService, PublicUrlService],
  exports: [FilesService],
})
export class FilesModule {}
