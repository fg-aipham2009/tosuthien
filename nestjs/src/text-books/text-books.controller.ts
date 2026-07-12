import { Controller, Get, Param, Query } from '@nestjs/common';
import { TextBooksService } from './text-books.service';

@Controller('text-books')
export class TextBooksController {
  constructor(private readonly service: TextBooksService) {}

  @Get('labels')
  labels() {
    return this.service.labels();
  }

  @Get()
  findAll(@Query('device_id') deviceId?: string) {
    return this.service.findAll(deviceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('device_id') deviceId?: string) {
    return this.service.findOne(id, deviceId);
  }

  @Get(':id/pages')
  getPages(
    @Param('id') id: string,
    @Query('from') fromRaw?: string,
    @Query('to') toRaw?: string,
  ) {
    const from = fromRaw ? Number(fromRaw) : 1;
    const to = toRaw ? Number(toRaw) : undefined;
    return this.service.getPages(id, from, to);
  }
}
