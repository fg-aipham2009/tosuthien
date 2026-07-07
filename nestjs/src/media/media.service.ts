import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMediaCategoryDto,
  UpdateMediaCategoryDto,
  CreateMp3Dto,
  UpdateMp3Dto,
  CreateYoutubeDto,
  UpdateYoutubeDto,
} from '../dto';
import { PublicUrlService } from '../common/public-url.service';
import { mp3PublicPath } from '../common/media-paths';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly urls: PublicUrlService,
  ) {}

  findCategories() {
    return this.prisma.mediaCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCategory(dto: CreateMediaCategoryDto) {
    return this.prisma.mediaCategory.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateMediaCategoryDto) {
    await this.ensureCategory(id);
    return this.prisma.mediaCategory.update({ where: { id }, data: dto });
  }

  async removeCategory(id: string) {
    await this.ensureCategory(id);
    await this.prisma.mediaCategory.delete({ where: { id } });
    return { deleted: true };
  }

  async findMp3(
    categorySlug?: string,
    year?: number,
    folderPath?: string,
    includeUnpublished = false,
  ) {
    const normalizedFolder = folderPath
      ? (folderPath.endsWith('/') ? folderPath : `${folderPath}/`)
      : undefined;

    return this.prisma.mp3Track.findMany({
      where: {
        ...(includeUnpublished ? {} : { isPublished: true }),
        ...(categorySlug && { category: { slug: categorySlug } }),
        ...(year && { year }),
        ...(normalizedFolder && { folderPath: normalizedFolder }),
      },
      include: { category: true },
      orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async createMp3(dto: CreateMp3Dto) {
    const storagePath = `${dto.folderPath.replace(/\/$/, '')}/${dto.filename}`;
    return this.prisma.mp3Track.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        year: dto.year,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : undefined,
        location: dto.location,
        description: dto.description,
        folderPath: dto.folderPath,
        filename: dto.filename,
        storagePath,
        publicUrl: this.urls.file(mp3PublicPath(storagePath)),
        durationSec: dto.durationSec,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { category: true },
    });
  }

  async updateMp3(id: string, dto: UpdateMp3Dto) {
    const row = await this.prisma.mp3Track.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('MP3 not found');

    const folderPath = dto.folderPath ?? row.folderPath;
    const filename = dto.filename ?? row.filename;
    const storagePath = `${folderPath.replace(/\/$/, '')}/${filename}`;

    return this.prisma.mp3Track.update({
      where: { id },
      data: {
        ...dto,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : undefined,
        folderPath,
        filename,
        storagePath,
        publicUrl: this.urls.file(mp3PublicPath(storagePath)),
      },
      include: { category: true },
    });
  }

  async removeMp3(id: string) {
    const row = await this.prisma.mp3Track.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('MP3 not found');
    await this.prisma.mp3Track.delete({ where: { id } });
    return { deleted: true };
  }

  async findYoutube(categorySlug?: string, includeUnpublished = false) {
    return this.prisma.youtubeVideo.findMany({
      where: {
        ...(includeUnpublished ? {} : { isPublished: true }),
        ...(categorySlug && { category: { slug: categorySlug } }),
      },
      include: { category: true },
      orderBy: [{ year: { sort: 'desc', nulls: 'last' } }, { sortOrder: 'asc' }],
    });
  }

  async createYoutube(dto: CreateYoutubeDto) {
    return this.prisma.youtubeVideo.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        youtubeId: dto.youtubeId,
        year: dto.year,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? true,
      },
      include: { category: true },
    });
  }

  async updateYoutube(id: string, dto: UpdateYoutubeDto) {
    const row = await this.prisma.youtubeVideo.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Video not found');
    return this.prisma.youtubeVideo.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
  }

  async removeYoutube(id: string) {
    const row = await this.prisma.youtubeVideo.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Video not found');
    await this.prisma.youtubeVideo.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureCategory(id: string) {
    const row = await this.prisma.mediaCategory.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }
}
