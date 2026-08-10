import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZoomRoomDto, UpdateZoomRoomDto } from '../dto';
import { slugify } from '../common/public-url.service';

@Injectable()
export class ZoomRoomsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(opts?: { all?: boolean }) {
    const where: Prisma.ZoomRoomWhereInput = {};
    if (!opts?.all) where.isPublished = true;
    return this.prisma.zoomRoom.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.zoomRoom.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Zoom room not found');
    return row;
  }

  async create(dto: CreateZoomRoomDto) {
    const code = await this.uniqueCode(dto.code || dto.name);
    return this.prisma.zoomRoom.create({
      data: {
        code,
        name: dto.name.trim(),
        meetingId: dto.meetingId.replace(/\s/g, '').trim(),
        pass: dto.pass?.trim() || null,
        url: this.resolveUrl(dto.url, dto.meetingId, dto.pass),
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateZoomRoomDto) {
    const existing = await this.findOne(id);
    const meetingId =
      dto.meetingId !== undefined
        ? dto.meetingId.replace(/\s/g, '').trim()
        : existing.meetingId;
    const pass =
      dto.pass !== undefined ? dto.pass.trim() || null : existing.pass;
    const url =
      dto.url !== undefined ||
      dto.meetingId !== undefined ||
      dto.pass !== undefined
        ? this.resolveUrl(
            dto.url !== undefined ? dto.url : existing.url,
            meetingId,
            pass,
          )
        : existing.url;

    return this.prisma.zoomRoom.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined
          ? { code: await this.uniqueCode(dto.code, id) }
          : {}),
        ...(dto.meetingId !== undefined ? { meetingId } : {}),
        ...(dto.pass !== undefined ? { pass } : {}),
        ...(dto.url !== undefined ||
        dto.meetingId !== undefined ||
        dto.pass !== undefined
          ? { url }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isPublished !== undefined
          ? { isPublished: dto.isPublished }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.zoomRoom.delete({ where: { id } });
    return { deleted: true };
  }

  private resolveUrl(
    url?: string | null,
    meetingId?: string | null,
    pass?: string | null,
  ): string | null {
    const explicit = url?.trim();
    if (explicit) return explicit;
    const id = meetingId?.replace(/\s/g, '').trim();
    if (!id) return null;
    const pwd = pass?.trim();
    return pwd
      ? `https://zoom.us/j/${id}?pwd=${encodeURIComponent(pwd)}`
      : `https://zoom.us/j/${id}`;
  }

  private async uniqueCode(base: string, excludeId?: string): Promise<string> {
    const root = slugify(base).toUpperCase().replace(/-/g, '_') || 'ZOOM';
    let candidate = root;
    let n = 2;
    for (;;) {
      const existing = await this.prisma.zoomRoom.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${root}_${n}`;
      n += 1;
    }
  }
}
