import { Injectable, NotFoundException } from '@nestjs/common';
import { Center, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCenterDto, UpdateCenterDto } from '../dto';
import { slugify } from '../common/public-url.service';
import { GalleryImage } from '../common/gallery-image.interface';
import {
  galleryImagesToJson,
  parseGalleryImages,
} from '../common/prisma-json.util';

@Injectable()
export class CentersService {
  constructor(private readonly prisma: PrismaService) {}

  private withSlug(dto: CreateCenterDto | UpdateCenterDto, existing?: Center): string {
    return (
      dto.slug ||
      existing?.slug ||
      slugify((dto as CreateCenterDto).templeName || existing?.templeName || 'center')
    );
  }

  async findAll(publishedOnly = true) {
    return this.prisma.center.findMany({
      where: publishedOnly ? { isPublished: true } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const center = await this.prisma.center.findUnique({
      where: { id },
      include: { courses: true },
    });
    if (!center) throw new NotFoundException('Center not found');
    return center;
  }

  async findBySlug(slug: string) {
    const center = await this.prisma.center.findUnique({
      where: { slug },
      include: { courses: true },
    });
    if (!center) throw new NotFoundException('Center not found');
    return center;
  }

  async create(dto: CreateCenterDto) {
    return this.prisma.center.create({
      data: {
        templeName: dto.templeName,
        slug: this.withSlug(dto),
        abbotName: dto.abbotName,
        address: dto.address,
        phone: dto.phone,
        abbotPhone: dto.abbotPhone,
        googleMapsUrl: dto.googleMapsUrl,
        lat: dto.lat,
        lng: dto.lng,
        activityHours: dto.activityHours,
        rules: dto.rules,
        customs: dto.customs,
        mainImageUrl: dto.mainImageUrl,
        galleryImages: galleryImagesToJson(dto.galleryImages ?? []),
        detailContent: dto.detailContent,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCenterDto) {
    const existing = await this.findOne(id);
    const data: Prisma.CenterUpdateInput = {};

    if (dto.templeName !== undefined) data.templeName = dto.templeName;
    if (dto.abbotName !== undefined) data.abbotName = dto.abbotName;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.abbotPhone !== undefined) data.abbotPhone = dto.abbotPhone;
    if (dto.googleMapsUrl !== undefined) data.googleMapsUrl = dto.googleMapsUrl;
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lng !== undefined) data.lng = dto.lng;
    if (dto.activityHours !== undefined) data.activityHours = dto.activityHours;
    if (dto.rules !== undefined) data.rules = dto.rules;
    if (dto.customs !== undefined) data.customs = dto.customs;
    if (dto.mainImageUrl !== undefined) data.mainImageUrl = dto.mainImageUrl;
    if (dto.detailContent !== undefined) data.detailContent = dto.detailContent;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;
    if (dto.galleryImages !== undefined) {
      data.galleryImages = galleryImagesToJson(dto.galleryImages);
    }
    if (dto.templeName !== undefined || dto.slug !== undefined) {
      data.slug = this.withSlug(dto, existing);
    }

    return this.prisma.center.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.center.delete({ where: { id } });
    return { deleted: true };
  }

  async setMainImage(id: string, url: string) {
    await this.findOne(id);
    return this.prisma.center.update({
      where: { id },
      data: { mainImageUrl: url },
    });
  }

  async addGalleryImage(id: string, image: GalleryImage) {
    const center = await this.findOne(id);
    const gallery = [...parseGalleryImages(center.galleryImages), image].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    return this.prisma.center.update({
      where: { id },
      data: { galleryImages: galleryImagesToJson(gallery) },
    });
  }

  async removeGalleryImage(id: string, url: string) {
    const center = await this.findOne(id);
    const gallery = parseGalleryImages(center.galleryImages).filter(
      (g) => g.url !== url,
    );
    return this.prisma.center.update({
      where: { id },
      data: { galleryImages: galleryImagesToJson(gallery) },
    });
  }
}
