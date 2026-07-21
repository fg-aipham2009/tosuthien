export interface GalleryImage {
  url: string;
  caption?: string;
  sort_order?: number;
}

export interface Center {
  id: string;
  slug: string | null;
  templeName: string;
  abbotName: string | null;
  abbotRank: string | null;
  abbotTitle: string | null;
  orgRole: string | null;
  genderSection: string | null;
  region: string | null;
  countryCode: string | null;
  province: string | null;
  address: string | null;
  phone: string | null;
  abbotPhone: string | null;
  googleMapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  activityHours: string | null;
  rules: string | null;
  customs: string | null;
  mainImageUrl: string | null;
  galleryImages: GalleryImage[] | unknown;
  detailContent: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  courses?: Course[];
}

export interface Course {
  id: string;
  title: string;
  type: string | null;
  recurrence: string | null;
  startDate: string | null;
  endDate: string | null;
  dayStart: number | null;
  dayEnd: number | null;
  weekday: number | null;
  scheduleText: string | null;
  centerId: string | null;
  contact: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  url: string;
  modifiedAt: string;
}

export interface FolderListing {
  root: string;
  currentPath: string;
  folders: string[];
  files: FileEntry[];
}

export type MediaRoot = 'pdf' | 'mp3' | 'images';

export interface CenterFormData {
  templeName: string;
  slug?: string;
  abbotName?: string;
  abbotRank?: string;
  abbotTitle?: string;
  orgRole?: string;
  genderSection?: string;
  region?: string;
  countryCode?: string;
  province?: string;
  address?: string;
  phone?: string;
  abbotPhone?: string;
  googleMapsUrl?: string;
  lat?: number | null;
  lng?: number | null;
  activityHours?: string;
  rules?: string;
  customs?: string;
  detailContent?: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface CourseFormData {
  title: string;
  type?: string;
  recurrence?: string;
  startDate?: string;
  endDate?: string;
  dayStart?: number | null;
  dayEnd?: number | null;
  weekday?: number | null;
  scheduleText?: string;
  centerId?: string;
  contact?: string;
  description?: string;
  sortOrder?: number;
}

export interface MediaCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface Mp3Track {
  id: string;
  categoryId: string;
  title: string;
  year: number;
  recordedAt?: string | null;
  location?: string | null;
  description?: string | null;
  folderPath: string;
  filename: string;
  storagePath?: string;
  publicUrl: string;
  durationSec?: number | null;
  fileSizeBytes?: number | string | null;
  isPublished: boolean;
  sortOrder: number;
  createdAt?: string;
  category?: MediaCategory;
}

export interface YoutubeVideo {
  id: string;
  categoryId: string;
  title: string;
  youtubeId: string;
  channel: string | null;
  year: number | null;
  publishedAt?: string | null;
  description: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt?: string;
  category?: MediaCategory;
}

/** Matches pdf_files table (admin / API). */
export interface PdfFile {
  id: string;
  slug: string;
  title: string;
  volume?: string | null;
  author: string;
  filename: string;
  folderPath: string;
  storagePath: string;
  publicUrl: string;
  pageCount?: number | null;
  fileSizeBytes?: number | string | null;
  coverImageUrl?: string | null;
  sortOrder: number;
  createdAt: string;
}

/** Matches rag_sources table. */
export interface RagSource {
  id: string;
  slug: string;
  title: string;
  volume?: string | null;
  author: string;
  sourceFile: string;
  folderPath: string;
  status: string;
  chunkCount: number;
  ingestedAt?: string | null;
  embeddedAt?: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface YoutubeFormData {
  categoryId: string;
  title: string;
  youtubeId: string;
  year?: number | null;
  description?: string;
  sortOrder?: number;
  isPublished?: boolean;
}
