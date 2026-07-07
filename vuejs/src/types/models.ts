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
  address: string;
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
  startDate: string | null;
  endDate: string | null;
  centerId: string | null;
  contact: string | null;
  description: string | null;
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
  address: string;
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
  startDate?: string;
  endDate?: string;
  centerId?: string;
  contact?: string;
  description?: string;
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
  folderPath: string;
  filename: string;
  publicUrl: string;
  isPublished: boolean;
  sortOrder: number;
  category?: MediaCategory;
}

export interface YoutubeVideo {
  id: string;
  categoryId: string;
  title: string;
  youtubeId: string;
  channel: string;
  year: number | null;
  description: string | null;
  sortOrder: number;
  isPublished: boolean;
  category?: MediaCategory;
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
