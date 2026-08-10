import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateClassAnnouncementDto,
  UpdateClassAnnouncementDto,
} from '../dto';

const DEFAULT_TEMPLE = 'TRƯỜNG HẠ CHÙA PHẬT ĐÀ';
const DEFAULT_ADDRESS =
  '362/46, Nguyễn Đình Chiểu, phường Bàn Cờ, Tp.HCM';

@Injectable()
export class ClassAnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  private include = {
    dharmaClass: { include: { defaultTeacher: true } },
    teacher: true,
  } as const;

  findAll(opts?: { all?: boolean; classId?: string }) {
    return this.prisma.classAnnouncement.findMany({
      where: {
        ...(opts?.all ? {} : { isPublished: true }),
        ...(opts?.classId ? { classId: opts.classId } : {}),
      },
      include: this.include,
      orderBy: [
        { sessionDate: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.classAnnouncement.findUnique({
      where: { id },
      include: this.include,
    });
    if (!row) throw new NotFoundException('Không tìm thấy thông báo');
    return row;
  }

  private parseDate(raw?: string | null) {
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  async create(dto: CreateClassAnnouncementDto) {
    const klass = await this.prisma.dharmaClass.findUnique({
      where: { id: dto.classId },
      include: { defaultTeacher: true },
    });
    if (!klass) throw new NotFoundException('Không tìm thấy lớp học');

    let teacherPhotoUrl: string | null = null;
    let teacherNameText = dto.teacherNameText?.trim() || null;
    const teacherId = dto.teacherId ?? klass.defaultTeacherId ?? null;

    if (teacherId) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
      });
      if (teacher) {
        teacherPhotoUrl = teacher.photoUrl;
        if (!teacherNameText) {
          teacherNameText = [teacher.rank, teacher.name].filter(Boolean).join(' ');
        }
      }
    }

    return this.prisma.classAnnouncement.create({
      data: {
        classId: dto.classId,
        teacherId,
        templeName: (dto.templeName || DEFAULT_TEMPLE).trim(),
        templeAddress: (dto.templeAddress ?? DEFAULT_ADDRESS)?.trim() || null,
        topicTitle: dto.topicTitle.trim(),
        formatNote:
          dto.formatNote?.trim() ||
          '(Học trực tiếp và Trực tuyến tối hàng tuần)',
        teacherNameText,
        teacherPhotoUrl,
        sessionDate: this.parseDate(dto.sessionDate),
        lunarDateText: dto.lunarDateText?.trim() || null,
        timeText: dto.timeText?.trim() || klass.timeText,
        zoomMeetingId: dto.zoomMeetingId?.trim() || klass.zoomMeetingId,
        zoomPass: dto.zoomPass?.trim() || klass.zoomPass,
        zoomUrl: dto.zoomUrl?.trim() || klass.zoomUrl,
        resourcesNote: dto.resourcesNote?.trim() || null,
        backgroundKey: dto.backgroundKey?.trim() || 'default',
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? true,
      },
      include: this.include,
    });
  }

  async update(id: string, dto: UpdateClassAnnouncementDto) {
    const current = await this.findOne(id);
    const data: Prisma.ClassAnnouncementUpdateInput = {};

    if (dto.classId !== undefined) {
      data.dharmaClass = { connect: { id: dto.classId } };
    }
    if (dto.teacherId !== undefined) {
      data.teacher = dto.teacherId
        ? { connect: { id: dto.teacherId } }
        : { disconnect: true };
      if (dto.teacherId) {
        const teacher = await this.prisma.teacher.findUnique({
          where: { id: dto.teacherId },
        });
        if (teacher) {
          if (dto.teacherNameText === undefined) {
            data.teacherNameText = [teacher.rank, teacher.name]
              .filter(Boolean)
              .join(' ');
          }
          if (!current.teacherPhotoUrl) {
            data.teacherPhotoUrl = teacher.photoUrl;
          }
        }
      }
    }
    if (dto.templeName !== undefined) data.templeName = dto.templeName.trim();
    if (dto.templeAddress !== undefined) {
      data.templeAddress = dto.templeAddress?.trim() || null;
    }
    if (dto.topicTitle !== undefined) data.topicTitle = dto.topicTitle.trim();
    if (dto.formatNote !== undefined) {
      data.formatNote = dto.formatNote?.trim() || null;
    }
    if (dto.teacherNameText !== undefined) {
      data.teacherNameText = dto.teacherNameText?.trim() || null;
    }
    if (dto.sessionDate !== undefined) {
      data.sessionDate = this.parseDate(dto.sessionDate);
    }
    if (dto.lunarDateText !== undefined) {
      data.lunarDateText = dto.lunarDateText?.trim() || null;
    }
    if (dto.timeText !== undefined) data.timeText = dto.timeText?.trim() || null;
    if (dto.zoomMeetingId !== undefined) {
      data.zoomMeetingId = dto.zoomMeetingId?.trim() || null;
    }
    if (dto.zoomPass !== undefined) data.zoomPass = dto.zoomPass?.trim() || null;
    if (dto.zoomUrl !== undefined) data.zoomUrl = dto.zoomUrl?.trim() || null;
    if (dto.resourcesNote !== undefined) {
      data.resourcesNote = dto.resourcesNote?.trim() || null;
    }
    if (dto.backgroundKey !== undefined) {
      data.backgroundKey = dto.backgroundKey?.trim() || 'default';
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;

    return this.prisma.classAnnouncement.update({
      where: { id },
      data,
      include: this.include,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.classAnnouncement.delete({ where: { id } });
    return { ok: true };
  }

  async setTeacherPhoto(id: string, url: string | null) {
    await this.findOne(id);
    return this.prisma.classAnnouncement.update({
      where: { id },
      data: { teacherPhotoUrl: url },
      include: this.include,
    });
  }
}
