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

  private async uniqueSlug(
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const root = slugify(base) || 'post';
    let candidate = root;
    let n = 2;
    for (;;) {
      const existing = await this.prisma.post.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${root}-${n}`;
      n += 1;
    }
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

    const where: Prisma.PostWhereInput = {};
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

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        include: postInclude,
        orderBy: [
          { isPinned: 'desc' },
          { sortOrder: 'asc' },
          { publishedAt: 'desc' },
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

  async findBySlug(slug: string) {
    const post = await this.prisma.post.findFirst({
      where: { slug, isPublished: true },
      include: postInclude,
    });
    if (!post) throw new NotFoundException('Post not found');
    return this.flatten(post as PostWithRelations);
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postInclude,
    });
    if (!post) throw new NotFoundException('Post not found');
    return this.flatten(post as PostWithRelations);
  }

  async create(dto: CreatePostDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.title);
    const publishedAt = this.parsePublishedAt(dto.publishedAt);
    const categoryIds = dto.categoryIds ?? [];

    if (categoryIds.length) await this.assertCategoryIds(categoryIds);

    const post = await this.prisma.post.create({
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        content: dto.content,
        coverImageUrl: dto.coverImageUrl,
        sourceUrl: dto.sourceUrl,
        authorName: dto.authorName,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        publishedAt: publishedAt === undefined ? undefined : publishedAt,
        isPinned: dto.isPinned ?? false,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? true,
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
    const existing = await this.prisma.post.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Post not found');

    const data: Prisma.PostUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.sourceUrl !== undefined) data.sourceUrl = dto.sourceUrl;
    if (dto.authorName !== undefined) data.authorName = dto.authorName;
    if (dto.seoTitle !== undefined) data.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) data.seoDescription = dto.seoDescription;
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;

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
    await this.findOne(id);
    await this.prisma.post.delete({ where: { id } });
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
