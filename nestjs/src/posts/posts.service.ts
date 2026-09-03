import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Post, PostCategory, PostImage, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePostCategoryDto,
  CreatePostDto,
  UpdatePostCategoryDto,
  UpdatePostDto,
} from '../dto';
import { slugify } from '../common/public-url.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PostWithRelations = Post & {
  categories: { category: PostCategory }[];
  images: PostImage[];
};

const postInclude = {
  categories: {
    include: { category: true },
  },
  images: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.PostInclude;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  private flatten(post: PostWithRelations) {
    const { categories, images, ...rest } = post;
    return {
      ...rest,
      categories: categories
        .map((link) => link.category)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      images,
    };
  }

  private parsePublishedAt(value?: string | null): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('publishedAt không hợp lệ (cần ISO string)');
    }
    return date;
  }

  /** Prefer explicit URL; otherwise build from meeting id + pass. */
  private resolveZoomUrl(
    zoomUrl?: string | null,
    meetingId?: string | null,
    pass?: string | null,
  ): string | null {
    const explicit = zoomUrl?.trim();
    if (explicit) return explicit;
    const id = meetingId?.replace(/\s/g, '').trim();
    if (!id) return null;
    const pwd = pass?.trim();
    return pwd
      ? `https://zoom.us/j/${id}?pwd=${encodeURIComponent(pwd)}`
      : `https://zoom.us/j/${id}`;
  }

  /** When zoomRoomId is set, copy meeting/pass/url from that room. */
  private async resolveZoomFromDto(dto: {
    zoomRoomId?: string | null;
    zoomMeetingId?: string;
    zoomPass?: string;
    zoomUrl?: string;
  }) {
    if (dto.zoomRoomId === null) {
      return {
        zoomRoomId: null as string | null,
        zoomMeetingId: null as string | null,
        zoomPass: null as string | null,
        zoomUrl: null as string | null,
      };
    }
    if (dto.zoomRoomId) {
      const room = await this.prisma.zoomRoom.findUnique({
        where: { id: dto.zoomRoomId },
      });
      if (!room) throw new BadRequestException('Zoom room not found');
      return {
        zoomRoomId: room.id,
        zoomMeetingId: room.meetingId,
        zoomPass: room.pass,
        zoomUrl: this.resolveZoomUrl(room.url, room.meetingId, room.pass),
      };
    }
    return {
      zoomMeetingId: dto.zoomMeetingId,
      zoomPass: dto.zoomPass,
      zoomUrl: this.resolveZoomUrl(
        dto.zoomUrl,
        dto.zoomMeetingId,
        dto.zoomPass,
      ),
    };
  }

  private async uniqueSlug(
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const root = slugify(base) || 'post';
    let candidate = root;
    let n = 2;
    for (;;) {
      const existing = await this.prisma.post.findFirst({
        where: {
          slug: candidate,
          isDeleted: false,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) return candidate;
      candidate = `${root}-${n}`;
      n += 1;
    }
  }

  /** Active (not soft-deleted) post filter. */
  private notDeleted(): Prisma.PostWhereInput {
    return { isDeleted: false };
  }

  private resolveKind(kind?: string | null): 'news' | 'class' | 'center' {
    if (kind === 'class' || kind === 'center' || kind === 'news') return kind;
    return 'news';
  }

  private resolveTitle(dto: {
    title?: string;
    description?: string;
    content?: string;
    kind?: string | null;
  }): string {
    const titled = dto.title?.trim();
    if (titled) return titled;
    const fromBody = (dto.description || dto.content || '')
      .trim()
      .split(/\n/)[0]
      ?.replace(/<[^>]+>/g, '')
      .trim()
      .slice(0, 80);
    if (fromBody) return fromBody;
    if (dto.kind === 'class') return 'Thông báo lớp học';
    if (dto.kind === 'center') return 'Thông báo thiền đường';
    return 'Tin tức';
  }

  private resolveBody(dto: { description?: string; content?: string }): {
    description: string | null;
    content: string | null;
  } {
    const body =
      (dto.description ?? dto.content ?? '').trim() || null;
    return { description: body, content: dto.content?.trim() || body };
  }

  private async uniqueCategorySlug(
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const root = slugify(base) || 'category';
    let candidate = root;
    let n = 2;
    for (;;) {
      const existing = await this.prisma.postCategory.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${root}-${n}`;
      n += 1;
    }
  }

  private async assertCategoryIds(ids: string[]) {
    if (!ids.length) return;
    const found = await this.prisma.postCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException('Một hoặc nhiều categoryIds không tồn tại');
    }
  }

  private async syncCategories(postId: string, categoryIds: string[]) {
    await this.assertCategoryIds(categoryIds);
    await this.prisma.postCategoryLink.deleteMany({ where: { postId } });
    if (!categoryIds.length) return;
    await this.prisma.postCategoryLink.createMany({
      data: categoryIds.map((categoryId) => ({ postId, categoryId })),
      skipDuplicates: true,
    });
  }

  async findAll(params: {
    all?: boolean;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PostWhereInput = {
      ...this.notDeleted(),
    };
    if (!params.all) {
      where.isPublished = true;
    }

    if (params.category?.trim()) {
      const cat = params.category.trim();
      where.categories = {
        some: UUID_RE.test(cat)
          ? { categoryId: cat }
          : { category: { slug: cat } },
      };
    }

    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Public list cards only need light fields — full HTML/images kill TTFB.
    if (!params.all) {
      const [total, rows] = await this.prisma.$transaction([
        this.prisma.post.count({ where }),
        this.prisma.post.findMany({
          where,
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            coverImageUrl: true,
            publishedAt: true,
            isPinned: true,
            sortOrder: true,
            isPublished: true,
            kind: true,
            topicText: true,
            teacherText: true,
            scheduleText: true,
            createdAt: true,
            updatedAt: true,
            description: true,
            categories: {
              include: { category: true },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          skip,
          take: limit,
        }),
      ]);

      return {
        items: rows.map((row) => {
          const { categories, description, excerpt, ...rest } = row;
          const excerptOut =
            (excerpt || '').trim() ||
            this.excerptFromHtml(description);
          return {
            ...rest,
            excerpt: excerptOut,
            content: null,
            description: null,
            images: [] as PostImage[],
            categories: categories
              .map((link) => link.category)
              .sort(
                (a, b) =>
                  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
              ),
          };
        }),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        include: postInclude,
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.flatten(row as PostWithRelations)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private excerptFromHtml(html?: string | null): string | null {
    if (!html?.trim()) return null;
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
    return text || null;
  }

  async findBySlug(slug: string) {
    const post = await this.prisma.post.findFirst({
      where: { slug, isPublished: true, isDeleted: false },
      include: postInclude,
    });
    if (!post) throw new NotFoundException('Post not found');
    return this.flatten(post as PostWithRelations);
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, isDeleted: false },
      include: postInclude,
    });
    if (!post) throw new NotFoundException('Post not found');
    return this.flatten(post as PostWithRelations);
  }

  async create(dto: CreatePostDto) {
    const kind = this.resolveKind(dto.kind);
    const title = this.resolveTitle({ ...dto, kind });
    const body = this.resolveBody(dto);
    const slug = await this.uniqueSlug(dto.slug || title);
    const publishedAt =
      this.parsePublishedAt(dto.publishedAt) ??
      (dto.publishedAt === undefined ? new Date() : null);
    const categoryIds = dto.categoryIds ?? [];

    if (categoryIds.length) await this.assertCategoryIds(categoryIds);

    const zoom = await this.resolveZoomFromDto(dto);

    const post = await this.prisma.post.create({
      data: {
        title,
        kind,
        slug,
        excerpt: dto.excerpt,
        content: body.content,
        coverImageUrl: dto.coverImageUrl,
        sourceUrl: dto.sourceUrl,
        authorName: dto.authorName,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        publishedAt: publishedAt === undefined ? undefined : publishedAt,
        isPinned: dto.isPinned ?? false,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? true,
        topicText: dto.topicText,
        teacherText: dto.teacherText,
        scheduleText: dto.scheduleText,
        zoomMeetingId: zoom.zoomMeetingId,
        zoomPass: zoom.zoomPass,
        zoomUrl: zoom.zoomUrl,
        ...(zoom.zoomRoomId !== undefined
          ? { zoomRoomId: zoom.zoomRoomId }
          : {}),
        description: body.description,
        ...(categoryIds.length
          ? {
              categories: {
                create: categoryIds.map((categoryId) => ({ categoryId })),
              },
            }
          : {}),
      },
      include: postInclude,
    });

    return this.flatten(post as PostWithRelations);
  }

  async update(id: string, dto: UpdatePostDto) {
    const existing = await this.prisma.post.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Post not found');

    const data: Prisma.PostUpdateInput = {};

    if (dto.title !== undefined) {
      data.title = dto.title.trim() || existing.title;
    }
    if (dto.kind !== undefined) data.kind = this.resolveKind(dto.kind);
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.content !== undefined || dto.description !== undefined) {
      const body = this.resolveBody({
        description:
          dto.description !== undefined
            ? dto.description
            : existing.description || undefined,
        content:
          dto.content !== undefined
            ? dto.content
            : existing.content || undefined,
      });
      data.description = body.description;
      data.content = body.content;
    }
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.sourceUrl !== undefined) data.sourceUrl = dto.sourceUrl;
    if (dto.authorName !== undefined) data.authorName = dto.authorName;
    if (dto.seoTitle !== undefined) data.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) data.seoDescription = dto.seoDescription;
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;
    if (dto.topicText !== undefined) data.topicText = dto.topicText;
    if (dto.teacherText !== undefined) data.teacherText = dto.teacherText;
    if (dto.scheduleText !== undefined) data.scheduleText = dto.scheduleText;

    if (
      dto.zoomRoomId !== undefined ||
      dto.zoomMeetingId !== undefined ||
      dto.zoomPass !== undefined ||
      dto.zoomUrl !== undefined
    ) {
      const zoom = await this.resolveZoomFromDto({
        zoomRoomId: dto.zoomRoomId,
        zoomMeetingId:
          dto.zoomMeetingId !== undefined
            ? dto.zoomMeetingId
            : existing.zoomMeetingId || undefined,
        zoomPass:
          dto.zoomPass !== undefined
            ? dto.zoomPass
            : existing.zoomPass || undefined,
        zoomUrl:
          dto.zoomUrl !== undefined
            ? dto.zoomUrl
            : existing.zoomUrl || undefined,
      });
      if (zoom.zoomRoomId !== undefined) {
        data.zoomRoom =
          zoom.zoomRoomId === null
            ? { disconnect: true }
            : { connect: { id: zoom.zoomRoomId } };
      }
      if (zoom.zoomMeetingId !== undefined) {
        data.zoomMeetingId = zoom.zoomMeetingId;
      }
      if (zoom.zoomPass !== undefined) data.zoomPass = zoom.zoomPass;
      if (zoom.zoomUrl !== undefined) data.zoomUrl = zoom.zoomUrl;
    }

    if (dto.publishedAt !== undefined) {
      data.publishedAt = this.parsePublishedAt(dto.publishedAt) ?? null;
    }

    if (dto.title !== undefined || dto.slug !== undefined) {
      data.slug = await this.uniqueSlug(
        dto.slug || dto.title || existing.title,
        id,
      );
    }

    await this.prisma.post.update({ where: { id }, data });

    if (dto.categoryIds !== undefined) {
      await this.syncCategories(id, dto.categoryIds);
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.prisma.post.findFirst({
      where: { id, isDeleted: false },
      select: { id: true, slug: true },
    });
    if (!existing) throw new NotFoundException('Post not found');

    // Soft delete — free the slug so a new post can reuse it.
    const deletedSlug = `${existing.slug}__deleted__${Date.now()}`;
    await this.prisma.post.update({
      where: { id },
      data: {
        isDeleted: true,
        isPublished: false,
        slug: deletedSlug.slice(0, 180),
      },
    });
    return { deleted: true };
  }

  async setCoverImage(id: string, url: string) {
    await this.findOne(id);

    const existingCover = await this.prisma.postImage.findFirst({
      where: { postId: id, role: 'cover' },
      orderBy: { sortOrder: 'asc' },
    });

    if (existingCover) {
      await this.prisma.postImage.update({
        where: { id: existingCover.id },
        data: { url, mimeType: null },
      });
    } else {
      await this.prisma.postImage.create({
        data: {
          postId: id,
          role: 'cover',
          url,
          sortOrder: 0,
        },
      });
    }

    await this.prisma.post.update({
      where: { id },
      data: { coverImageUrl: url },
    });

    return this.findOne(id);
  }

  async clearCoverImage(id: string) {
    await this.findOne(id);
    await this.prisma.postImage.deleteMany({
      where: { postId: id, role: 'cover' },
    });
    await this.prisma.post.update({
      where: { id },
      data: { coverImageUrl: null },
    });
    return this.findOne(id);
  }

  async addContentImages(
    id: string,
    images: { url: string; mimeType?: string | null; fileSize?: number | null }[],
  ) {
    await this.findOne(id);
    const maxSort = await this.prisma.postImage.aggregate({
      where: { postId: id, role: 'content' },
      _max: { sortOrder: true },
    });
    let sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    for (const image of images) {
      await this.prisma.postImage.create({
        data: {
          postId: id,
          role: 'content',
          url: image.url,
          mimeType: image.mimeType ?? null,
          fileSize:
            image.fileSize != null ? BigInt(image.fileSize) : null,
          sortOrder,
        },
      });
      sortOrder += 1;
    }

    return this.findOne(id);
  }

  async removeImage(postId: string, imageId: string) {
    const image = await this.prisma.postImage.findFirst({
      where: { id: imageId, postId },
    });
    if (!image) throw new NotFoundException('Post image not found');

    await this.prisma.postImage.delete({ where: { id: imageId } });

    if (image.role === 'cover') {
      const post = await this.prisma.post.findUnique({ where: { id: postId } });
      if (post?.coverImageUrl === image.url) {
        await this.prisma.post.update({
          where: { id: postId },
          data: { coverImageUrl: null },
        });
      }
    }

    return this.findOne(postId);
  }

  findCategories() {
    return this.prisma.postCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(dto: CreatePostCategoryDto) {
    const slug = await this.uniqueCategorySlug(dto.slug || dto.name);
    return this.prisma.postCategory.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(id: string, dto: UpdatePostCategoryDto) {
    const existing = await this.prisma.postCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Post category not found');

    const data: Prisma.PostCategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.name !== undefined || dto.slug !== undefined) {
      data.slug = await this.uniqueCategorySlug(
        dto.slug || dto.name || existing.name,
        id,
      );
    }

    return this.prisma.postCategory.update({ where: { id }, data });
  }

  async removeCategory(id: string) {
    const existing = await this.prisma.postCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Post category not found');
    await this.prisma.postCategory.delete({ where: { id } });
    return { deleted: true };
  }
}
