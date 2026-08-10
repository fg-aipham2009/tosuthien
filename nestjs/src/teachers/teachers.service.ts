import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherDto, UpdateTeacherDto } from '../dto';
import { slugify } from '../common/public-url.service';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(opts?: { all?: boolean }) {
    return this.prisma.teacher.findMany({
      where: opts?.all ? undefined : { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.teacher.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy giảng sư');
    return row;
  }

  private async uniqueSlug(base: string, excludeId?: string) {
    let slug = slugify(base) || `teacher-${Date.now()}`;
    let n = 0;
    while (true) {
      const hit = await this.prisma.teacher.findUnique({ where: { slug } });
      if (!hit || hit.id === excludeId) return slug;
      n += 1;
      slug = `${slugify(base)}-${n}`;
    }
  }

  async create(dto: CreateTeacherDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.name);
    try {
      return await this.prisma.teacher.create({
        data: {
          name: dto.name.trim(),
          slug,
          rank: dto.rank?.trim() || null,
          bio: dto.bio?.trim() || null,
          sortOrder: dto.sortOrder ?? 0,
          isPublished: dto.isPublished ?? true,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Slug giảng sư đã tồn tại');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateTeacherDto) {
    await this.findOne(id);
    const data: Prisma.TeacherUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.rank !== undefined) data.rank = dto.rank?.trim() || null;
    if (dto.bio !== undefined) data.bio = dto.bio?.trim() || null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;
    if (dto.slug !== undefined) {
      data.slug = await this.uniqueSlug(dto.slug || dto.name || id, id);
    }
    return this.prisma.teacher.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.teacher.delete({ where: { id } });
    return { ok: true };
  }

  async setPhoto(id: string, url: string | null) {
    await this.findOne(id);
    return this.prisma.teacher.update({
      where: { id },
      data: { photoUrl: url },
    });
  }
}
