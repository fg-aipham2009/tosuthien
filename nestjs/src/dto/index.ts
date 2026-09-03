import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
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

  /** Rank prefix: HT, TT, ĐĐ, NS, SC */
  @IsOptional()
  @IsString()
  abbotRank?: string;

  /** Role at temple: Trụ trì, Viện chủ, … */
  @IsOptional()
  @IsString()
  abbotTitle?: string;

  /** Org role: Chứng minh, Phó, TBTK, … */
  @IsOptional()
  @IsString()
  orgRole?: string;

  /** TANG | NI */
  @IsOptional()
  @IsString()
  genderSection?: string;

  /** BAC | TRUNG | NAM | NUOC_NGOAI */
  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  address?: string;

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
  displayOrder?: number;

  /** @deprecated Dùng displayOrder */
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

  /** REGULAR | SPRING | WINTER | AN_CU | OTHER */
  @IsOptional()
  @IsString()
  type?: string;

  /** ONCE | WEEKLY | MONTHLY_RANGE | YEARLY | SELF_PRACTICE */
  @IsOptional()
  @IsString()
  recurrence?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayStart?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayEnd?: number;

  /** 0=Sunday … 6=Saturday */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @IsOptional()
  @IsString()
  scheduleText?: string;

  @IsOptional()
  @IsUUID()
  centerId?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
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

  @IsOptional()
  @IsString()
  coverImageUrl?: string;
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

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
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

export class ToggleMp3FavoriteDto {
  @IsString()
  deviceId!: string;

  @IsUUID()
  mp3TrackId!: string;
}

export class ChatHistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  content!: string;
}

export class ChatDto {
  @IsString()
  question!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  topK?: number;

  /** Hard filter: only search these OCR source files (e.g. ["21.txt","10.txt"]). Omit = all books. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceFiles?: string[];

  /** Prior turns only (exclude the current question). Used for multi-turn disambiguation. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryMessageDto)
  messages?: ChatHistoryMessageDto[];
}

export class CreatePostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(['news', 'class', 'center'])
  kind?: 'news' | 'class' | 'center';

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  /** ISO date string for public display date. */
  @IsOptional()
  @IsString()
  publishedAt?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  topicText?: string;

  @IsOptional()
  @IsString()
  teacherText?: string;

  @IsOptional()
  @IsString()
  scheduleText?: string;

  @IsOptional()
  @IsString()
  zoomMeetingId?: string;

  @IsOptional()
  @IsString()
  zoomPass?: string;

  @IsOptional()
  @IsString()
  zoomUrl?: string;

  @IsOptional()
  @IsUUID()
  zoomRoomId?: string | null;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePostDto extends PartialType(CreatePostDto) {}

export class CreatePostCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdatePostCategoryDto extends PartialType(CreatePostCategoryDto) {}

/** Giảng sư */
export class CreateTeacherDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  rank?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}

/** Lớp học (3 lớp cố định — admin chỉnh Zoom / tên) */
export class UpdateDharmaClassDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  shortName?: string;

  @IsOptional()
  @IsInt()
  weekday?: number;

  @IsOptional()
  @IsString()
  timeText?: string;

  @IsOptional()
  @IsString()
  zoomMeetingId?: string;

  @IsOptional()
  @IsString()
  zoomPass?: string;

  @IsOptional()
  @IsString()
  zoomUrl?: string;

  @IsOptional()
  @IsUUID()
  defaultTeacherId?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

/** Thông báo khóa học / poster */
export class CreateClassAnnouncementDto {
  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string | null;

  @IsOptional()
  @IsString()
  templeName?: string;

  @IsOptional()
  @IsString()
  templeAddress?: string;

  @IsString()
  topicTitle!: string;

  @IsOptional()
  @IsString()
  formatNote?: string;

  @IsOptional()
  @IsString()
  teacherNameText?: string;

  @IsOptional()
  @IsString()
  sessionDate?: string;

  @IsOptional()
  @IsString()
  lunarDateText?: string;

  @IsOptional()
  @IsString()
  timeText?: string;

  @IsOptional()
  @IsString()
  zoomMeetingId?: string;

  @IsOptional()
  @IsString()
  zoomPass?: string;

  @IsOptional()
  @IsString()
  zoomUrl?: string;

  @IsOptional()
  @IsString()
  resourcesNote?: string;

  @IsOptional()
  @IsString()
  backgroundKey?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateClassAnnouncementDto extends PartialType(
  CreateClassAnnouncementDto,
) {}

export class CreateZoomRoomDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  meetingId!: string;

  @IsOptional()
  @IsString()
  pass?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateZoomRoomDto extends PartialType(CreateZoomRoomDto) {}
