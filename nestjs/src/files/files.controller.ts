import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
} from '@nestjs/common';
import { IsIn, IsString, MinLength } from 'class-validator';
import { FilesService } from './files.service';

class CreateFolderDto {
  @IsString()
  @IsIn(['pdf', 'mp3', 'images'])
  root!: string;

  @IsString()
  @MinLength(1)
  path!: string;
}

@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Get('roots')
  roots() {
    return this.service.listRoots();
  }

  @Get('list')
  list(
    @Query('root') root: string,
    @Query('path') folderPath?: string,
  ) {
    return this.service.listFolder(root, folderPath ?? '');
  }

  @Post('folders')
  createFolder(@Body() dto: CreateFolderDto) {
    return this.service.createFolder(dto.root, dto.path);
  }

  @Delete()
  remove(
    @Query('root') root: string,
    @Query('path') filePath: string,
  ) {
    return this.service.deleteFile(root, filePath);
  }
}
