import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { GalleryImage } from '../common/gallery-image.interface';

export class CreateCenterDto {
  @IsString()
  templeName!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  abbotName?: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  abbotPhone?: string;

  @IsOptional()
  @IsString()
  googleMapsUrl?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  activityHours?: string;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsOptional()
  @IsString()
  customs?: string;

  @IsOptional()
  @IsString()
  mainImageUrl?: string;

  @IsOptional()
  galleryImages?: GalleryImage[];

  @IsOptional()
  @IsString()
  detailContent?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateCenterDto extends PartialType(CreateCenterDto) {}

export class CreateCourseDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  centerId?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

export class CreatePdfDto {
  @IsString()
  slug!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  volume?: string;

  @IsString()
  filename!: string;

  @IsOptional()
  @IsInt()
  pageCount?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdatePdfDto extends PartialType(CreatePdfDto) {}

export class UpsertReadingProgressDto {
  @IsString()
  deviceId!: string;

  @IsUUID()
  pdfFileId!: string;

  @IsInt()
  @Min(1)
  lastPage!: number;
}

export class CreateMp3Dto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  title!: string;

  @IsInt()
  year!: number;

  @IsString()
  folderPath!: string;

  @IsString()
  filename!: string;

  @IsOptional()
  @IsString()
  recordedAt?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  durationSec?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateMp3Dto extends PartialType(CreateMp3Dto) {}

export class CreateYoutubeDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  title!: string;

  @IsString()
  youtubeId!: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateYoutubeDto extends PartialType(CreateYoutubeDto) {}

export class CreateMediaCategoryDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateMediaCategoryDto extends PartialType(CreateMediaCategoryDto) {}

export class ChatDto {
  @IsString()
  question!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  topK?: number;
}
