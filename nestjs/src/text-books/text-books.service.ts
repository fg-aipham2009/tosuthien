import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

type CatalogBook = {
  id: string;
  source?: string;
  title?: string | null;
  author?: string;
  pageCount?: number;
  blankPages?: number;
  status?: string;
  format?: string;
  pagesDir?: string;
  message?: string;
};

type CatalogFile = {
  version?: number;
  labelBanGoc?: string;
  labelDocChu?: string;
  books: CatalogBook[];
};

export type TextBookSummary = {
  id: string;
  title: string;
  author: string;
  pageCount: number;
  blankPages: number;
  source: string | null;
  pdfFileId: string | null;
  coverImageUrl: string | null;
  lastPage: number | null;
  lastReadAt: Date | null;
};

@Injectable()
export class TextBooksService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private root(): string {
    return path.resolve(
      this.config.get<string>('TEXT_BOOKS_ROOT') ||
        path.join(process.cwd(), '..', 'text', 'doc-chu', 'books'),
    );
  }

  private readCatalog(): CatalogFile {
    const catalogPath = path.join(this.root(), 'catalog.json');
    if (!fs.existsSync(catalogPath)) {
      return {
        labelBanGoc: 'Bản gốc',
        labelDocChu: 'Đọc chữ',
        books: [],
      };
    }
    return JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as CatalogFile;
  }

  private bookDir(id: string): string {
    return path.join(this.root(), id);
  }

  private readBookMeta(id: string): CatalogBook {
    const metaPath = path.join(this.bookDir(id), 'book.json');
    if (!fs.existsSync(metaPath)) {
      throw new NotFoundException(`Text book not found: ${id}`);
    }
    return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as CatalogBook;
  }

  private pagePath(id: string, page: number): string {
    return path.join(this.bookDir(id), 'pages', `${String(page).padStart(4, '0')}.txt`);
  }

  labels() {
    const catalog = this.readCatalog();
    return {
      banGoc: catalog.labelBanGoc || 'Bản gốc',
      docChu: catalog.labelDocChu || 'Đọc chữ',
    };
  }

  async findAll(deviceId?: string): Promise<TextBookSummary[]> {
    const catalog = this.readCatalog();
    const ready = catalog.books.filter((b) => b.status === 'ready');
    if (ready.length === 0) return [];

    const pdfs = await this.prisma.pdfFile.findMany({
      select: { id: true, filename: true, coverImageUrl: true },
    });
    const pdfByStem = new Map<string, { id: string; coverImageUrl: string | null }>();
    for (const pdf of pdfs) {
      const stem = pdf.filename.replace(/\.pdf$/i, '');
      pdfByStem.set(stem, { id: pdf.id, coverImageUrl: pdf.coverImageUrl });
    }

    const progressMap = new Map<string, { lastPage: number; updatedAt: Date }>();
    if (deviceId) {
      const progress = await this.prisma.readingProgress.findMany({
        where: { deviceId },
      });
      for (const row of progress) {
        progressMap.set(row.pdfFileId, {
          lastPage: row.lastPage,
          updatedAt: row.updatedAt,
        });
      }
    }

    return ready.map((b) => {
      const linked = pdfByStem.get(b.id) ?? null;
      const rp = linked ? progressMap.get(linked.id) : undefined;
      return {
        id: b.id,
        title: b.title || `Kinh sách ${b.id}`,
        author: b.author || 'Hòa thượng Thích Duy Lực',
        pageCount: b.pageCount || 0,
        blankPages: b.blankPages || 0,
        source: b.source || null,
        pdfFileId: linked?.id ?? null,
        coverImageUrl: linked?.coverImageUrl ?? null,
        lastPage: rp?.lastPage ?? null,
        lastReadAt: rp?.updatedAt ?? null,
      };
    });
  }

  async findOne(id: string, deviceId?: string): Promise<TextBookSummary> {
    const meta = this.readBookMeta(id);
    if (meta.status && meta.status !== 'ready') {
      throw new NotFoundException(`Text book not ready: ${id}`);
    }

    const pdf = await this.prisma.pdfFile.findFirst({
      where: { filename: `${id}.pdf` },
      select: { id: true, coverImageUrl: true },
    });
    let lastPage: number | null = null;
    let lastReadAt: Date | null = null;
    if (pdf && deviceId) {
      const rp = await this.prisma.readingProgress.findUnique({
        where: {
          deviceId_pdfFileId: { deviceId, pdfFileId: pdf.id },
        },
      });
      lastPage = rp?.lastPage ?? null;
      lastReadAt = rp?.updatedAt ?? null;
    }

    return {
      id,
      title: meta.title || `Kinh sách ${id}`,
      author: meta.author || 'Hòa thượng Thích Duy Lực',
      pageCount: meta.pageCount || 0,
      blankPages: meta.blankPages || 0,
      source: meta.source || null,
      pdfFileId: pdf?.id ?? null,
      coverImageUrl: pdf?.coverImageUrl ?? null,
      lastPage,
      lastReadAt,
    };
  }

  getPages(id: string, from = 1, to?: number) {
    const meta = this.readBookMeta(id);
    const pageCount = meta.pageCount || 0;
    if (pageCount < 1) {
      throw new BadRequestException('Book has no pages');
    }

    const start = Math.max(1, Math.floor(from));
    const end = Math.min(pageCount, Math.floor(to ?? start + 19));
    if (start > end) {
      throw new BadRequestException('Invalid page range');
    }

    const pages: Array<{ page: number; text: string; isBlank: boolean }> = [];
    for (let n = start; n <= end; n++) {
      const file = this.pagePath(id, n);
      if (!fs.existsSync(file)) {
        pages.push({ page: n, text: '', isBlank: true });
        continue;
      }
      const text = fs.readFileSync(file, 'utf8').replace(/\s+$/, '');
      pages.push({
        page: n,
        text,
        isBlank: text.trim().length === 0,
      });
    }

    return {
      id,
      title: meta.title || `Kinh sách ${id}`,
      pageCount,
      from: start,
      to: end,
      pages,
    };
  }
}
