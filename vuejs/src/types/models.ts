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
  displayOrder: number;
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
  displayOrder?: number;
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

/** Danh mục tin tức (post_categories). */
export interface PostCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Ảnh nội dung / cover gắn với bài viết (post_images). */
export interface PostImage {
  id: string;
  postId: string;
  role: string;
  url: string;
  altText?: string | null;
  caption?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  sortOrder: number;
  createdAt?: string;
}

/** Tin tức / bài viết (posts). */
export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  contentFormat?: string;
  coverImageUrl: string | null;
  sourceUrl?: string | null;
  authorName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  isPinned: boolean;
  sortOrder: number;
  isPublished: boolean;
  kind?: 'news' | 'class' | 'center' | string;
  topicText?: string | null;
  teacherText?: string | null;
  scheduleText?: string | null;
  zoomMeetingId?: string | null;
  zoomPass?: string | null;
  zoomUrl?: string | null;
  zoomRoomId?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt?: string;
  categories: PostCategory[];
  images: PostImage[];
}

export interface PostFormData {
  title: string;
  slug?: string;
  categoryIds?: string[];
  excerpt?: string;
  content?: string;
  authorName?: string;
  publishedAt?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  isPinned?: boolean;
  sortOrder?: number;
  isPublished?: boolean;
  kind?: 'news' | 'class' | 'center';
  topicText?: string;
  teacherText?: string;
  scheduleText?: string;
  zoomMeetingId?: string;
  zoomPass?: string;
  zoomUrl?: string;
  zoomRoomId?: string | null;
  description?: string;
}

export interface ZoomRoom {
  id: string;
  code: string;
  name: string;
  meetingId: string;
  pass: string | null;
  url: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ZoomRoomFormData {
  name: string;
  code?: string;
  meetingId: string;
  pass?: string;
  url?: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface PostCategoryFormData {
  name: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
}

export interface PaginatedPosts {
  items: Post[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Giảng sư / giáo thọ */
export interface Teacher {
  id: string;
  slug: string;
  rank: string | null;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeacherFormData {
  name: string;
  slug?: string;
  rank?: string;
  bio?: string;
  sortOrder?: number;
  isPublished?: boolean;
}

/** 3 lớp học cố định */
export interface DharmaClass {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  weekday: number | null;
  timeText: string | null;
  zoomMeetingId: string | null;
  zoomPass: string | null;
  zoomUrl: string | null;
  defaultTeacherId: string | null;
  sortOrder: number;
  isPublished: boolean;
  defaultTeacher?: Teacher | null;
}

export interface DharmaClassFormData {
  name?: string;
  shortName?: string;
  weekday?: number | null;
  timeText?: string;
  zoomMeetingId?: string;
  zoomPass?: string;
  zoomUrl?: string;
  defaultTeacherId?: string | null;
  sortOrder?: number;
  isPublished?: boolean;
}

/** Thông báo khóa học / poster */
export interface ClassAnnouncement {
  id: string;
  classId: string;
  teacherId: string | null;
  templeName: string;
  templeAddress: string | null;
  topicTitle: string;
  formatNote: string | null;
  teacherNameText: string | null;
  teacherPhotoUrl: string | null;
  sessionDate: string | null;
  lunarDateText: string | null;
  timeText: string | null;
  zoomMeetingId: string | null;
  zoomPass: string | null;
  zoomUrl: string | null;
  resourcesNote: string | null;
  backgroundKey: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  dharmaClass?: DharmaClass;
  teacher?: Teacher | null;
}

export interface ClassAnnouncementFormData {
  classId: string;
  teacherId?: string | null;
  templeName?: string;
  templeAddress?: string;
  topicTitle: string;
  formatNote?: string;
  teacherNameText?: string;
  sessionDate?: string | null;
  lunarDateText?: string;
  timeText?: string;
  zoomMeetingId?: string;
  zoomPass?: string;
  zoomUrl?: string;
  resourcesNote?: string;
  backgroundKey?: string;
  sortOrder?: number;
  isPublished?: boolean;
}
