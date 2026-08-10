import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDharmaClassDto } from '../dto';

@Injectable()
export class DharmaClassesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(opts?: { all?: boolean }) {
    return this.prisma.dharmaClass.findMany({
      where: opts?.all ? undefined : { isPublished: true },
      include: { defaultTeacher: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.dharmaClass.findUnique({
      where: { id },
      include: { defaultTeacher: true },
    });
    if (!row) throw new NotFoundException('Không tìm thấy lớp học');
    return row;
  }

  async update(id: string, dto: UpdateDharmaClassDto) {
    await this.findOne(id);
    const data: Prisma.DharmaClassUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.shortName !== undefined) data.shortName = dto.shortName?.trim() || null;
    if (dto.weekday !== undefined) data.weekday = dto.weekday;
    if (dto.timeText !== undefined) data.timeText = dto.timeText?.trim() || null;
    if (dto.zoomMeetingId !== undefined) {
      data.zoomMeetingId = dto.zoomMeetingId?.trim() || null;
    }
    if (dto.zoomPass !== undefined) data.zoomPass = dto.zoomPass?.trim() || null;
    if (dto.zoomUrl !== undefined) data.zoomUrl = dto.zoomUrl?.trim() || null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;
    if (dto.defaultTeacherId !== undefined) {
      data.defaultTeacher = dto.defaultTeacherId
        ? { connect: { id: dto.defaultTeacherId } }
        : { disconnect: true };
    }
    return this.prisma.dharmaClass.update({
      where: { id },
      data,
      include: { defaultTeacher: true },
    });
  }
}
