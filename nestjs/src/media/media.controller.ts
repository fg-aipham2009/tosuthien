import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { MediaService } from './media.service';
import {
  CreateMediaCategoryDto,
  UpdateMediaCategoryDto,
  CreateMp3Dto,
  UpdateMp3Dto,
  CreateYoutubeDto,
  UpdateYoutubeDto,
} from '../dto';

@Controller('media/categories')
export class MediaCategoriesController {
  constructor(private readonly service: MediaService) {}

  @Get()
  findAll() {
    return this.service.findCategories();
  }

  @Post()
  create(@Body() dto: CreateMediaCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMediaCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeCategory(id);
  }
}

@Controller('mp3/tracks')
export class Mp3Controller {
  constructor(private readonly service: MediaService) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('year') year?: string,
    @Query('folder') folder?: string,
    @Query('all') all?: string,
  ) {
    return this.service.findMp3(
      category,
      year ? parseInt(year, 10) : undefined,
      folder,
      all === 'true',
    );
  }

  @Post()
  create(@Body() dto: CreateMp3Dto) {
    return this.service.createMp3(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMp3Dto) {
    return this.service.updateMp3(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeMp3(id);
  }
}

@Controller('youtube/videos')
export class YoutubeController {
  constructor(private readonly service: MediaService) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('all') all?: string,
  ) {
    return this.service.findYoutube(category, all === 'true');
  }

  @Post()
  create(@Body() dto: CreateYoutubeDto) {
    return this.service.createYoutube(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateYoutubeDto) {
    return this.service.updateYoutube(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeYoutube(id);
  }
}
