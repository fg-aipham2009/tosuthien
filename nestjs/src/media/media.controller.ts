import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZipArchive } from 'archiver';
import { MediaService } from './media.service';
import {
  CreateMediaCategoryDto,
  UpdateMediaCategoryDto,
  CreateMp3Dto,
  UpdateMp3Dto,
  CreateYoutubeDto,
  UpdateYoutubeDto,
  ToggleMp3FavoriteDto,
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

@Controller('mp3/folders')
export class Mp3FoldersController {
  constructor(private readonly service: MediaService) {}

  /** Distinct folder paths (lightweight — for lazy UI like Flutter). */
  @Get()
  listFolders(
    @Query('category') category?: string,
    @Query('year') year?: string,
    @Query('all') all?: string,
  ) {
    return this.service.findMp3FolderPaths(
      category,
      year ? parseInt(year, 10) : undefined,
      all === 'true',
    );
  }

  /** Stream a zip of all .mp3 files in one folder (store — no recompress). */
  @Get('zip')
  zipFolder(@Query('folder') folder: string | undefined, @Res() res: Response) {
    if (!folder?.trim()) {
      throw new BadRequestException('folder is required');
    }
    const { zipName, files } = this.service.resolveMp3FolderFiles(folder.trim());

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
    );
    res.setHeader('Cache-Control', 'no-store');

    const archive = new ZipArchive({ store: true });
    archive.on('error', (err: Error) => {
      if (!res.headersSent) {
        res.status(500).json({ message: err.message });
      } else {
        res.destroy(err);
      }
    });
    archive.pipe(res);

    for (const f of files) {
      archive.file(f.abs, { name: f.name });
    }
    void archive.finalize();
  }
}

@Controller('mp3/years')
export class Mp3YearsController {
  constructor(private readonly service: MediaService) {}

  @Get()
  listYears(
    @Query('category') category?: string,
    @Query('folder') folder?: string,
    @Query('all') all?: string,
  ) {
    return this.service.findMp3Years(category, folder, all === 'true');
  }
}

@Controller('mp3/favorites')
export class Mp3FavoritesController {
  constructor(private readonly service: MediaService) {}

  @Get()
  findAll(@Query('device_id') deviceId?: string) {
    if (!deviceId?.trim()) {
      throw new BadRequestException('device_id is required');
    }
    return this.service.findFavorites(deviceId.trim());
  }

  @Get('ids')
  listIds(@Query('device_id') deviceId?: string) {
    if (!deviceId?.trim()) {
      throw new BadRequestException('device_id is required');
    }
    return this.service.listFavoriteIds(deviceId.trim());
  }

  @Post('toggle')
  toggle(@Body() dto: ToggleMp3FavoriteDto) {
    return this.service.toggleFavorite(dto);
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
