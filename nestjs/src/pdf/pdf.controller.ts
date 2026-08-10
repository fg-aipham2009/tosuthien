import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PdfService } from './pdf.service';
import { UpsertReadingProgressDto } from '../dto';

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
}

@Controller('reading-progress')
export class ReadingProgressController {
  constructor(private readonly service: PdfService) {}

  @Put()
  upsert(@Body() dto: UpsertReadingProgressDto) {
    return this.service.upsertProgress(dto);
  }
}
