import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { DharmaClassesService } from './dharma-classes.service';
import { UpdateDharmaClassDto } from '../dto';

@Controller('dharma-classes')
export class DharmaClassesController {
  constructor(private readonly service: DharmaClassesService) {}

  @Get()
  findAll(@Query('all') all?: string) {
    return this.service.findAll({ all: all === 'true' });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDharmaClassDto,
  ) {
    return this.service.update(id, dto);
  }
}
