import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import {
  CreatePostCategoryDto,
  CreatePostDto,
  UpdatePostCategoryDto,
  UpdatePostDto,
} from '../dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly service: PostsService) {}

  @Get('categories')
  findCategories() {
    return this.service.findCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreatePostCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Put('categories/:id')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostCategoryDto,
  ) {
    return this.service.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeCategory(id);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Delete(':postId/images/:imageId')
  removeImage(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.service.removeImage(postId, imageId);
  }

  @Delete(':id/cover-image')
  clearCoverImage(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.clearCoverImage(id);
  }

  @Put(':id/cover-image')
  setCoverImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('url') url?: string,
  ) {
    const clean = url?.trim();
    if (!clean) {
      return this.service.clearCoverImage(id);
    }
    return this.service.setCoverImage(id, clean);
  }

  @Get()
  findAll(
    @Query('all') all?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      all: all === 'true',
      category,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePostDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
