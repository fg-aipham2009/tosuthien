import { Injectable, OnModuleInit } from '@nestjs/common';
import { PdfFile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUrlService } from '../common/public-url.service';
import { ChatCitation, PdfOpenLink } from './rag.types';

type PdfIndexEntry = Pick<PdfFile, 'id' | 'title' | 'volume' | 'publicUrl' | 'slug'>;

@Injectable()
export class CitationLinkService implements OnModuleInit {
  private pdfIndex: PdfIndexEntry[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly urls: PublicUrlService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshIndex();
  }

  async refreshIndex(): Promise<void> {
    this.pdfIndex = await this.prisma.pdfFile.findMany({
      select: { id: true, title: true, volume: true, publicUrl: true, slug: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  enrichCitation(
    citation: Omit<ChatCitation, 'pdf' | 'openLabel'>,
  ): ChatCitation {
    const pdf = this.findPdf(citation.title, citation.volume);
    const pdfLink = pdf ? this.buildPdfLink(pdf, citation.pageNum) : null;

    return {
      ...citation,
      pdf: pdfLink,
      openLabel: pdfLink?.openLabel ?? null,
    };
  }

  private findPdf(title: string, volume: string | null): PdfIndexEntry | null {
    if (!this.pdfIndex.length) return null;

    const normTitle = normalizeKey(title);
    const normVol = volume ? normalizeKey(volume) : '';

    let best: PdfIndexEntry | null = null;
    let bestScore = 0;

    for (const pdf of this.pdfIndex) {
      const pdfTitle = normalizeKey(pdf.title);
      const pdfVol = pdf.volume ? normalizeKey(pdf.volume) : '';
      let score = 0;

      if (pdfTitle === normTitle) score += 10;
      else if (pdfTitle.includes(normTitle) || normTitle.includes(pdfTitle)) score += 6;

      if (normVol && pdfVol && pdfVol.includes(normVol)) score += 3;

      if (score > bestScore) {
        bestScore = score;
        best = pdf;
      }
    }

    return bestScore >= 6 ? best : null;
  }

  private buildPdfLink(pdf: PdfIndexEntry, pageNum: number | null): PdfOpenLink {
    const page = pageNum ?? 1;
    const baseUrl = pdf.publicUrl || this.urls.file(`pdf/${pdf.slug}.pdf`);
    const pageHash = pageNum != null ? `#page=${pageNum}` : '';

    return {
      pdfFileId: pdf.id,
      pdfTitle: pdf.title,
      pdfSlug: pdf.slug,
      pdfUrl: `${baseUrl}${pageHash}`,
      pageNum: pageNum ?? null,
      openLabel: pageNum != null ? `Mở tr.${pageNum}` : 'Mở kinh sách',
      apiPath: `/api/pdfs/${pdf.id}?page=${page}`,
    };
  }
}

function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
