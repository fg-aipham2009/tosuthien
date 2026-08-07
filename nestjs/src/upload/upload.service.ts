import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PublicUrlService, slugify } from '../common/public-url.service';
import { MEDIA_DIRS } from '../common/media-paths';
import { PdfService } from '../pdf/pdf.service';
import { CentersService } from '../centers/centers.service';
import { MediaService } from '../media/media.service';
import { PostsService } from '../posts/posts.service';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MP3_EXT = new Set(['.mp3']);
const PDF_EXT = new Set(['.pdf']);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MiB

interface Mp3UploadBody {
  categoryId: string;
  year: number;
  folderPath: string;
  title?: string;
  titlePrefix?: string;
}

@Injectable()
export class UploadService {
  private readonly dataRoot: string;

  constructor(
    private readonly config: ConfigService,
    private readonly urls: PublicUrlService,
    private readonly pdfService: PdfService,
    private readonly centersService: CentersService,
    private readonly mediaService: MediaService,
    private readonly postsService: PostsService,
  ) {
    this.dataRoot = path.resolve(
      this.config.get<string>('DATA_ROOT') || path.join(process.cwd(), '..', 'data'),
    );
    for (const dir of Object.values(MEDIA_DIRS)) {
      fs.mkdirSync(path.join(this.dataRoot, dir), { recursive: true });
    }
  }

  async uploadPdf(file: Express.Multer.File, title?: string) {
    this.assertExt(file, PDF_EXT, 'PDF');
    const { rel } = this.saveFile(MEDIA_DIRS.pdf, file);
    const filename = path.basename(rel);
    return this.pdfService.create({
      slug: slugify(title || filename.replace('.pdf', '')),
      title: title || filename,
      filename,
    });
  }

  async uploadMp3(file: Express.Multer.File, body: Mp3UploadBody) {
    return this.saveMp3(file, body);
  }

  async uploadMp3Batch(files: Express.Multer.File[], body: Mp3UploadBody) {
    this.requireFiles(files);
    const tracks = [];
    for (const file of files) {
      tracks.push(await this.saveMp3(file, body));
    }
    const folder = this.normalizeFolder(body.folderPath);
    return { count: tracks.length, folderPath: `${folder}/`, tracks };
  }

  async uploadImagesBatch(files: Express.Multer.File[], folderPath: string) {
    this.requireFiles(files);
    const folder = this.normalizeFolder(folderPath);
    const images = files.map((file) => {
      this.assertImage(file);
      const { rel, url, size } = this.saveFile(path.join(MEDIA_DIRS.images, folder), file);
      return { filename: path.basename(rel), url, size };
    });
    return { count: images.length, folderPath: `${folder}/`, images };
  }

  async uploadCenterMain(id: string, file: Express.Multer.File) {
    this.assertImage(file);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const { url } = this.saveFile(
      MEDIA_DIRS.images,
      file,
      path.join('centers', id, `main${ext}`),
    );
    return this.centersService.setMainImage(id, url);
  }

  async uploadCenterGallery(
    id: string,
    file: Express.Multer.File,
    caption?: string,
    sortOrder?: number,
  ) {
    this.assertImage(file);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const { url } = this.saveFile(
      MEDIA_DIRS.images,
      file,
      path.join('centers', id, `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`),
    );
    return this.centersService.addGalleryImage(id, {
      url,
      caption,
      sort_order: sortOrder ?? 0,
    });
  }

  async uploadCenterGalleryBatch(id: string, files: Express.Multer.File[]) {
    this.requireFiles(files);
    for (let i = 0; i < files.length; i++) {
      await this.uploadCenterGallery(id, files[i], undefined, i);
    }
    return this.centersService.findOne(id);
  }

  async uploadPdfCover(id: string, file: Express.Multer.File) {
    this.assertImage(file);
    // Always store book covers as PNG to avoid broken JPEG/WebP display.
    const pngBuffer = await this.toPngBuffer(file);
    const { url } = this.saveBuffer(
      MEDIA_DIRS.images,
      pngBuffer,
      path.join('books', id, 'cover.png'),
    );
    // Remove legacy cover.* if present
    const bookDir = path.join(this.dataRoot, MEDIA_DIRS.images, 'books', id);
    for (const legacy of ['cover.jpg', 'cover.jpeg', 'cover.webp', 'cover.gif']) {
      const p = path.join(bookDir, legacy);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    return this.pdfService.setCoverImage(id, url);
  }

  async clearPdfCover(id: string) {
    return this.pdfService.setCoverImage(id, null);
  }

  async uploadPostCover(id: string, file: Express.Multer.File) {
    this.assertImage(file);
    // Always store tin tức covers as PNG (same pipeline as book covers).
    const pngBuffer = await this.toPngBuffer(file);
    const { url } = this.saveBuffer(
      MEDIA_DIRS.images,
      pngBuffer,
      path.join('posts', id, 'cover.png'),
    );
    const postDir = path.join(this.dataRoot, MEDIA_DIRS.images, 'posts', id);
    for (const legacy of ['cover.jpg', 'cover.jpeg', 'cover.webp', 'cover.gif']) {
      const p = path.join(postDir, legacy);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    return this.postsService.setCoverImage(id, url);
  }

  async uploadPostImages(id: string, files: Express.Multer.File[]) {
    this.requireFiles(files);
    if (files.length > 50) {
      throw new BadRequestException('Tối đa 50 ảnh mỗi lần upload');
    }
    const images = [];
    for (const file of files) {
      this.assertImage(file);
      const pngBuffer = await this.toPngBuffer(file);
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const { url, size } = this.saveBuffer(
        MEDIA_DIRS.images,
        pngBuffer,
        path.join('posts', id, name),
      );
      images.push({
        url,
        mimeType: 'image/png',
        fileSize: size,
      });
    }
    return this.postsService.addContentImages(id, images);
  }

  private async saveMp3(file: Express.Multer.File, body: Mp3UploadBody) {
    this.assertExt(file, MP3_EXT, 'MP3');
    const folder = this.normalizeFolder(body.folderPath);
    const { rel } = this.saveFile(path.join(MEDIA_DIRS.mp3, folder), file);
    const filename = path.basename(rel);
    const title =
      body.title?.trim()
      || path.basename(file.originalname, path.extname(file.originalname));

    return this.mediaService.createMp3({
      categoryId: body.categoryId,
      title,
      year: Number(body.year),
      folderPath: `${folder}/`,
      filename,
    });
  }

  private normalizeFolder(folderPath: string): string {
    return folderPath.replace(/^\/+|\/+$/g, '');
  }

  private requireFiles(files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('Cần ít nhất 1 file (field: files)');
    }
  }

  private assertImage(file: Express.Multer.File) {
    this.assertExt(file, IMAGE_EXT, 'Hình ảnh');
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Hình ảnh tối đa 15MB');
    }
  }

  private assertExt(file: Express.Multer.File, allowed: Set<string>, label: string) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.has(ext)) {
      throw new BadRequestException(`${label}: định dạng ${ext || 'unknown'} không hợp lệ`);
    }
  }

  private saveFile(subdir: string, file: Express.Multer.File, filename?: string) {
    if (!file) throw new BadRequestException('File required');
    const name = filename || file.originalname.replace(/[^\w.\-]+/g, '-');
    const rel = path.join(subdir, name).replace(/\\/g, '/');
    const abs = path.join(this.dataRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, file.buffer);
    return { rel, url: this.urls.file(rel), size: file.size };
  }

  private saveBuffer(subdir: string, buffer: Buffer, filename: string) {
    const rel = path.join(subdir, filename).replace(/\\/g, '/');
    const abs = path.join(this.dataRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buffer);
    return { rel, url: this.urls.file(rel), size: buffer.length };
  }

  /** Chuẩn hóa mọi ảnh bìa kinh sách về PNG để tránh bể hiển thị. */
  private async toPngBuffer(file: Express.Multer.File): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    try {
      return await sharp(file.buffer).rotate().png({ compressionLevel: 9 }).toBuffer();
    } catch {
      throw new BadRequestException('Không chuyển được ảnh sang PNG');
    }
  }
}
