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
import { ZoomRoomsService } from './zoom-rooms.service';
import { CreateZoomRoomDto, UpdateZoomRoomDto } from '../dto';

@Controller('zoom-rooms')
export class ZoomRoomsController {
  constructor(private readonly service: ZoomRoomsService) {}

  @Get()
  findAll(@Query('all') all?: string) {
    return this.service.findAll({ all: all === 'true' });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateZoomRoomDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZoomRoomDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
