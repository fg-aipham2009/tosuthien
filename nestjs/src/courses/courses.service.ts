import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, UpdateCourseDto } from '../dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(centerId?: string) {
    return this.prisma.course.findMany({
      where: centerId ? { centerId } : undefined,
      include: { center: true },
      orderBy: [{ sortOrder: 'asc' }, { startDate: 'desc' }],
    });
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { center: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async create(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        title: dto.title,
        type: dto.type,
        recurrence: dto.recurrence,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        dayStart: dto.dayStart,
        dayEnd: dto.dayEnd,
        weekday: dto.weekday,
        scheduleText: dto.scheduleText,
        centerId: dto.centerId,
        contact: dto.contact,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { center: true },
    });
  }

  async update(id: string, dto: UpdateCourseDto) {
    await this.findOne(id);
    return this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title,
        type: dto.type,
        recurrence: dto.recurrence,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        dayStart: dto.dayStart,
        dayEnd: dto.dayEnd,
        weekday: dto.weekday,
        scheduleText: dto.scheduleText,
        centerId: dto.centerId,
        contact: dto.contact,
        description: dto.description,
        sortOrder: dto.sortOrder,
      },
      include: { center: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.course.delete({ where: { id } });
    return { deleted: true };
  }
}
