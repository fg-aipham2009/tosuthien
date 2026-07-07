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
import { PdfService } from './pdf.service';
import { CreatePdfDto, UpdatePdfDto, UpsertReadingProgressDto } from '../dto';

@Controller('pdfs')
export class PdfController {
  constructor(private readonly service: PdfService) {}

  @Get()
  findAll(@Query('device_id') deviceId?: string) {
    return this.service.findAll(deviceId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('device_id') deviceId?: string,
  ) {
    return this.service.findOne(id, deviceId);
  }

  @Post()
  create(@Body() dto: CreatePdfDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePdfDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}

@Controller('reading-progress')
export class ReadingProgressController {
  constructor(private readonly service: PdfService) {}

  @Put()
  upsert(@Body() dto: UpsertReadingProgressDto) {
    return this.service.upsertProgress(dto);
  }
}
