import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMediaCategoryDto,
  UpdateMediaCategoryDto,
  CreateMp3Dto,
  UpdateMp3Dto,
  CreateYoutubeDto,
  UpdateYoutubeDto,
  ToggleMp3FavoriteDto,
} from '../dto';
import { PublicUrlService } from '../common/public-url.service';
import { MEDIA_DIRS, mp3PublicPath } from '../common/media-paths';

@Injectable()
export class MediaService {
  private readonly dataRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly urls: PublicUrlService,
    private readonly config: ConfigService,
  ) {
    this.dataRoot = path.resolve(
      this.config.get<string>('DATA_ROOT') ||
        path.join(process.cwd(), '..', 'data'),
    );
  }

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

  /** Distinct folder paths for lazy album browsing (no track payloads). */
  async findMp3FolderPaths(
    categorySlug?: string,
    year?: number,
    includeUnpublished = false,
  ): Promise<string[]> {
    const rows = await this.prisma.mp3Track.findMany({
      where: {
        ...(includeUnpublished ? {} : { isPublished: true }),
        ...(categorySlug && { category: { slug: categorySlug } }),
        ...(year && { year }),
      },
      distinct: ['folderPath'],
      select: { folderPath: true },
      orderBy: { folderPath: 'asc' },
    });
    return rows.map((r) => r.folderPath);
  }

  /** Distinct years for year chips without loading tracks. */
  async findMp3Years(
    categorySlug?: string,
    folderPath?: string,
    includeUnpublished = false,
  ): Promise<number[]> {
    const normalizedFolder = folderPath
      ? (folderPath.endsWith('/') ? folderPath : `${folderPath}/`)
      : undefined;

    const rows = await this.prisma.mp3Track.findMany({
      where: {
        ...(includeUnpublished ? {} : { isPublished: true }),
        ...(categorySlug && { category: { slug: categorySlug } }),
        ...(normalizedFolder && { folderPath: normalizedFolder }),
      },
      distinct: ['year'],
      select: { year: true },
      orderBy: { year: 'desc' },
    });
    return rows.map((r) => r.year);
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

  /** Favorited tracks for a device — online streaming metadata from DB. */
  async findFavorites(deviceId: string) {
    const rows = await this.prisma.mp3Favorite.findMany({
      where: { deviceId },
      include: {
        track: { include: { category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows
      .filter((r) => r.track.isPublished)
      .map((r) => ({
        ...r.track,
        favoritedAt: r.createdAt,
      }));
  }

  async listFavoriteIds(deviceId: string) {
    const rows = await this.prisma.mp3Favorite.findMany({
      where: { deviceId },
      select: { mp3TrackId: true },
    });
    return { ids: rows.map((r) => r.mp3TrackId) };
  }

  async toggleFavorite(dto: ToggleMp3FavoriteDto) {
    const track = await this.prisma.mp3Track.findUnique({
      where: { id: dto.mp3TrackId },
    });
    if (!track) throw new NotFoundException('MP3 not found');

    const existing = await this.prisma.mp3Favorite.findUnique({
      where: {
        deviceId_mp3TrackId: {
          deviceId: dto.deviceId,
          mp3TrackId: dto.mp3TrackId,
        },
      },
    });

    if (existing) {
      await this.prisma.mp3Favorite.delete({ where: { id: existing.id } });
      return { favorited: false, mp3TrackId: dto.mp3TrackId };
    }

    await this.prisma.mp3Favorite.create({
      data: {
        deviceId: dto.deviceId,
        mp3TrackId: dto.mp3TrackId,
      },
    });
    return { favorited: true, mp3TrackId: dto.mp3TrackId };
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

  /**
   * Resolve absolute directory for an MP3 folderPath (DB value, trailing slash OK).
   * Returns list of existing .mp3 files to include in a zip.
   */
  resolveMp3FolderFiles(folderPath: string): {
    absDir: string;
    zipName: string;
    files: { abs: string; name: string }[];
  } {
    const clean = folderPath
      .replace(/^\/+/, '')
      .replace(/\\/g, '/')
      .replace(/\/+$/, '');
    if (!clean || clean.includes('..')) {
      throw new BadRequestException('folder path không hợp lệ');
    }

    const base = path.join(this.dataRoot, MEDIA_DIRS.mp3);
    const absDir = path.join(base, clean);
    const rel = path.relative(base, absDir);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new BadRequestException('folder path nằm ngoài data/mp3');
    }
    if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
      throw new NotFoundException('Thư mục MP3 không tồn tại');
    }

    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.mp3'))
      .map((e) => ({
        abs: path.join(absDir, e.name),
        name: e.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    if (!files.length) {
      throw new NotFoundException('Thư mục không có file MP3');
    }

    const leaf = clean.split('/').filter(Boolean).pop() || 'mp3-folder'
    const zipName = `${leaf.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'mp3-folder'}.zip`

    return { absDir, zipName, files };
  }
}
