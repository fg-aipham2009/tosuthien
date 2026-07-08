import {
  Controller,
  Post,
  Param,
  ParseUUIDPipe,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';

/** Max upload size per file (MP3/PDF/images). Must match nginx client_max_body_size. */
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024; // 1 GiB

const MEM = memoryStorage();
const UPLOAD_OPTS = {
  storage: MEM,
  limits: { fileSize: MAX_UPLOAD_BYTES },
};

@Controller('upload')
export class UploadController {
  constructor(private readonly service: UploadService) {}

  @Post('pdf')
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTS))
  uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
  ) {
    return this.service.uploadPdf(file, title);
  }

  @Post('mp3')
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTS))
  uploadMp3(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { categoryId: string; title?: string; year: string; folderPath: string },
  ) {
    return this.service.uploadMp3(file, {
      categoryId: body.categoryId,
      title: body.title,
      year: parseInt(body.year, 10),
      folderPath: body.folderPath,
    });
  }

  @Post('mp3/batch')
  @UseInterceptors(FilesInterceptor('files', 100, UPLOAD_OPTS))
  uploadMp3Batch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { categoryId: string; year: string; folderPath: string; titlePrefix?: string },
  ) {
    return this.service.uploadMp3Batch(files, {
      categoryId: body.categoryId,
      year: parseInt(body.year, 10),
      folderPath: body.folderPath,
      titlePrefix: body.titlePrefix,
    });
  }

  @Post('images/batch')
  @UseInterceptors(FilesInterceptor('files', 100, UPLOAD_OPTS))
  uploadImagesBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folderPath') folderPath: string,
  ) {
    return this.service.uploadImagesBatch(files, folderPath);
  }

  @Post('centers/:id/main')
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTS))
  uploadCenterMain(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadCenterMain(id, file);
  }

  @Post('centers/:id/gallery')
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTS))
  uploadCenterGallery(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption?: string,
    @Body('sort_order') sortOrder?: string,
  ) {
    return this.service.uploadCenterGallery(
      id,
      file,
      caption,
      sortOrder ? parseInt(sortOrder, 10) : undefined,
    );
  }

  @Post('centers/:id/gallery/batch')
  @UseInterceptors(FilesInterceptor('files', 50, UPLOAD_OPTS))
  uploadCenterGalleryBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.service.uploadCenterGalleryBatch(id, files);
  }
}
