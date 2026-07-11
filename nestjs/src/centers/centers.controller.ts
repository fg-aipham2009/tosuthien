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
} from '@nestjs/common';
import { CentersService } from './centers.service';
import { CreateCenterDto, UpdateCenterDto } from '../dto';

@Controller('centers')
export class CentersController {
  constructor(private readonly service: CentersService) {}

  @Get()
  findAll(
    @Query('all') all?: string,
    @Query('region') region?: string,
  ) {
    return this.service.findAll(all !== 'true', region);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCenterDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCenterDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Delete(':id/gallery')
  removeGallery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('url') url: string,
  ) {
    return this.service.removeGalleryImage(id, url);
  }
}
