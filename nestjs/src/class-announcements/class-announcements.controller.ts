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
import { ClassAnnouncementsService } from './class-announcements.service';
import {
  CreateClassAnnouncementDto,
  UpdateClassAnnouncementDto,
} from '../dto';

@Controller('class-announcements')
export class ClassAnnouncementsController {
  constructor(private readonly service: ClassAnnouncementsService) {}

  @Get()
  findAll(
    @Query('all') all?: string,
    @Query('classId') classId?: string,
  ) {
    return this.service.findAll({
      all: all === 'true',
      classId,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateClassAnnouncementDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassAnnouncementDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
