export type CenterRegion = "NAM" | "TRUNG" | "BAC" | "NUOC_NGOAI";

export type GalleryImage = {
  url: string;
  sort_order?: number;
  caption?: string | null;
};

export type CenterCourse = {
  id: string;
  title: string;
  type?: string | null;
  recurrence?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dayStart?: number | null;
  dayEnd?: number | null;
  weekday?: number | null;
  scheduleText?: string | null;
  description?: string | null;
  sortOrder?: number;
};

export type Center = {
  id: string;
  slug: string | null;
  templeName: string;
  abbotName?: string | null;
  abbotRank?: string | null;
  abbotTitle?: string | null;
  orgRole?: string | null;
  genderSection?: string | null;
  region?: CenterRegion | string | null;
  countryCode?: string | null;
  province?: string | null;
  address?: string | null;
  phone?: string | null;
  abbotPhone?: string | null;
  googleMapsUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  activityHours?: string | null;
  rules?: string | null;
  customs?: string | null;
  mainImageUrl?: string | null;
  galleryImages?: GalleryImage[] | string[];
  detailContent?: string | null;
  displayOrder?: number;
  /** @deprecated dùng displayOrder */
  sortOrder?: number;
  isPublished?: boolean;
  courses?: CenterCourse[];
};
