import { API_BASE } from "./api";

export type TeacherBrief = {
  id: string;
  slug: string;
  rank: string | null;
  name: string;
  photoUrl: string | null;
};

export type DharmaClassBrief = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  weekday: number | null;
  timeText: string | null;
  zoomMeetingId: string | null;
  zoomPass: string | null;
  zoomUrl: string | null;
  defaultTeacher?: TeacherBrief | null;
};

export type ClassAnnouncement = {
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
  dharmaClass?: DharmaClassBrief;
  teacher?: TeacherBrief | null;
};

export async function fetchClassAnnouncements(opts?: {
  classId?: string;
  limit?: number;
}): Promise<ClassAnnouncement[]> {
  const qs = new URLSearchParams();
  if (opts?.classId) qs.set("classId", opts.classId);
  const res = await fetch(
    `${API_BASE}/class-announcements${qs.toString() ? `?${qs}` : ""}`,
    { next: { revalidate: 60 } },
  );
  if (!res.ok) return [];
  const all = (await res.json()) as ClassAnnouncement[];
  const published = all.filter((a) => a.isPublished);
  return typeof opts?.limit === "number"
    ? published.slice(0, opts.limit)
    : published;
}

export async function fetchDharmaClasses(): Promise<DharmaClassBrief[]> {
  const res = await fetch(`${API_BASE}/dharma-classes`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  return res.json();
}

export function formatSessionDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(iso);
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function announcementHeadline(a: ClassAnnouncement): string {
  const className =
    a.dharmaClass?.shortName || a.dharmaClass?.name || "Tổ Sư Thiền";
  const date = formatSessionDate(a.sessionDate);
  const lunar = a.lunarDateText ? ` (${a.lunarDateText})` : "";
  const schedule =
    a.timeText?.trim() ||
    a.dharmaClass?.timeText?.trim() ||
    "19h00-20h00";
  const bits = [
    `Lớp học ${className} ${schedule}.`,
    date ? `Ngày ${date}${lunar}.` : "",
    a.teacherNameText
      ? `${a.teacherNameText} giảng đề tài: “${a.topicTitle}”.`
      : `Đề tài: “${a.topicTitle}”.`,
  ];
  return bits.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function zoomJoinUrl(a: ClassAnnouncement): string | null {
  if (a.zoomUrl?.trim()) return a.zoomUrl.trim();
  if (!a.zoomMeetingId) return null;
  const id = a.zoomMeetingId.replace(/\s+/g, "");
  return `https://zoom.us/j/${id}`;
}
