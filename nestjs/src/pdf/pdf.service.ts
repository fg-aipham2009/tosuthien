import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PdfFile, ReadingProgress } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePdfDto, UpdatePdfDto, UpsertReadingProgressDto } from '../dto';
import { PublicUrlService } from '../common/public-url.service';

type PdfWithProgress = PdfFile & {
  lastPage: number | null;
  lastReadAt: Date | null;
};

@Injectable()
export class PdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly urls: PublicUrlService,
  ) {}

  async findAll(deviceId?: string): Promise<PdfWithProgress[]> {
    const pdfs = await this.prisma.pdfFile.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    if (!deviceId) {
      return pdfs.map((p) => ({ ...p, lastPage: null, lastReadAt: null }));
    }

    const progress = await this.prisma.readingProgress.findMany({
      where: { deviceId },
    });
    const map = new Map<string, ReadingProgress>(
      progress.map((r) => [r.pdfFileId, r]),
    );

    return pdfs.map((p) => {
      const rp = map.get(p.id);
      return {
        ...p,
        lastPage: rp?.lastPage ?? null,
        lastReadAt: rp?.updatedAt ?? null,
      };
    });
  }

  async findOne(id: string, deviceId?: string) {
    const pdf = await this.prisma.pdfFile.findUnique({ where: { id } });
    if (!pdf) throw new NotFoundException('PDF not found');
    if (!deviceId) return pdf;

    const rp = await this.prisma.readingProgress.findUnique({
      where: {
        deviceId_pdfFileId: { deviceId, pdfFileId: id },
      },
    });
    return {
      ...pdf,
      lastPage: rp?.lastPage ?? null,
      lastReadAt: rp?.updatedAt ?? null,
    };
  }

  async create(dto: CreatePdfDto) {
    const storagePath = `pdf/${dto.filename}`;
    return this.prisma.pdfFile.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        volume: dto.volume,
        author: 'Hòa thượng Thích Duy Lực',
        filename: dto.filename,
        folderPath: 'pdf/',
        storagePath,
        publicUrl: this.urls.file(storagePath),
        pageCount: dto.pageCount,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async setCoverImage(id: string, url: string | null) {
    await this.findOne(id);
    return this.prisma.pdfFile.update({
      where: { id },
      data: { coverImageUrl: url },
    });
  }

  async update(id: string, dto: UpdatePdfDto) {
    await this.findOne(id);
    const data: Prisma.PdfFileUpdateInput = {
      slug: dto.slug,
      title: dto.title,
      volume: dto.volume,
      filename: dto.filename,
      pageCount: dto.pageCount,
      sortOrder: dto.sortOrder,
    };
    if (dto.coverImageUrl !== undefined) {
      data.coverImageUrl = dto.coverImageUrl;
    }
    if (dto.filename) {
      const storagePath = `pdf/${dto.filename}`;
      data.storagePath = storagePath;
      data.publicUrl = this.urls.file(storagePath);
    }
    return this.prisma.pdfFile.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.pdfFile.delete({ where: { id } });
    return { deleted: true };
  }

  async upsertProgress(dto: UpsertReadingProgressDto) {
    const pdf = await this.prisma.pdfFile.findUnique({
      where: { id: dto.pdfFileId },
    });
    if (!pdf) throw new NotFoundException('PDF not found');

    return this.prisma.readingProgress.upsert({
      where: {
        deviceId_pdfFileId: {
          deviceId: dto.deviceId,
          pdfFileId: dto.pdfFileId,
        },
      },
      create: {
        deviceId: dto.deviceId,
        pdfFileId: dto.pdfFileId,
        lastPage: dto.lastPage,
      },
      update: {
        lastPage: dto.lastPage,
        updatedAt: new Date(),
      },
    });
  }
}
