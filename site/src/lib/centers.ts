import type { Center, CenterCourse, CenterRegion, GalleryImage } from "./types";

export const REGION_LABELS: Record<CenterRegion, string> = {
  NAM: "Miền Nam",
  TRUNG: "Miền Trung",
  BAC: "Miền Bắc",
  NUOC_NGOAI: "Ngoài Nước",
};

export const REGION_ORDER: CenterRegion[] = [
  "NAM",
  "TRUNG",
  "BAC",
  "NUOC_NGOAI",
];

export function regionLabel(region?: string | null): string {
  if (!region) return "Khác";
  return REGION_LABELS[region as CenterRegion] ?? region;
}

export function abbotLine(c: Center): string | null {
  const name = [c.abbotRank, c.abbotName].filter(Boolean).join(" ").trim();
  if (!name) return null;
  const title = c.abbotTitle?.trim();
  return title ? `${title} · ${name}` : name;
}

export function addressLine(c: Center): string | null {
  const parts = [c.address?.trim(), c.province?.trim()].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function galleryUrls(c: Center): string[] {
  const raw = c.galleryImages;
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string" ? item : (item as GalleryImage).url))
    .filter(Boolean);
}

export function courseScheduleLabel(course: CenterCourse): string {
  const text = course.scheduleText?.trim();
  if (text) return text;
  if (course.dayStart != null && course.dayEnd != null) {
    return `Ngày ${course.dayStart}–${course.dayEnd} hàng tháng`;
  }
  if (course.startDate && course.endDate) {
    return `${fmtDate(course.startDate)} – ${fmtDate(course.endDate)}`;
  }
  if (course.startDate) return `Từ ${fmtDate(course.startDate)}`;
  return "Lịch cập nhật sau";
}

export function courseTypeLabel(course: CenterCourse): string {
  switch (course.type) {
    case "SPRING":
      return "Khóa mùa xuân";
    case "WINTER":
      return "Khóa mùa đông";
    case "AN_CU":
      return "An cư";
    case "REGULAR":
      return "Khóa tu thiền thất";
    default:
      return course.title || "Khóa tu";
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("vi-VN");
}

export function groupByRegion(centers: Center[]): Record<CenterRegion | "OTHER", Center[]> {
  const groups: Record<CenterRegion | "OTHER", Center[]> = {
    NAM: [],
    TRUNG: [],
    BAC: [],
    NUOC_NGOAI: [],
    OTHER: [],
  };
  for (const c of centers) {
    const r = c.region as CenterRegion | undefined;
    if (r && r in groups) groups[r].push(c);
    else groups.OTHER.push(c);
  }
  return groups;
}

export function centerHref(c: Center): string {
  return `/thien-duong/${encodeURIComponent(c.slug || c.id)}`;
}
