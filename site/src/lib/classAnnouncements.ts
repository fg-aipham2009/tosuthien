import { API_BASE } from "./api";

export type TeacherBrief = {
  id: string;
  slug: string;
  rank: string | null;
  name: string;
  photoUrl: string | null;
};

/** Published teachers (for tin tức list banners). */
export async function fetchTeachers(): Promise<TeacherBrief[]> {
  try {
    const res = await fetch(`${API_BASE}/teachers`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function teacherLabel(t: TeacherBrief): string {
  return [t.rank, t.name].filter(Boolean).join(" ");
}

/** Match free-text giảng sư (e.g. "Hoà thượng Thích Minh Hiền") to teacher photo. */
export function resolveTeacherPhotoUrl(
  teacherText: string | null | undefined,
  teachers: TeacherBrief[],
): string | undefined {
  const raw = (teacherText || "").trim().toLowerCase();
  if (!raw || !teachers.length) return undefined;

  const exact = teachers.find(
    (t) => teacherLabel(t).toLowerCase() === raw,
  );
  if (exact?.photoUrl) return exact.photoUrl;

  const byName = teachers
    .filter((t) => {
      const name = t.name.toLowerCase();
      return name.length >= 4 && (raw.includes(name) || name.includes(raw));
    })
    .sort((a, b) => b.name.length - a.name.length)[0];
  return byName?.photoUrl || undefined;
}

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

export type ZoomRoomBrief = {
  id: string;
  code: string;
  name: string;
  meetingId: string;
  pass: string | null;
  url: string | null;
  sortOrder: number;
};

/** Published Zoom rooms (homepage: 2 rooms, already merged by meeting). */
export async function fetchZoomRooms(): Promise<ZoomRoomBrief[]> {
  try {
    const res = await fetch(`${API_BASE}/zoom-rooms`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Published Zoom / schedule rooms for the homepage. */
export async function fetchDharmaClasses(): Promise<DharmaClassBrief[]> {
  const res = await fetch(`${API_BASE}/dharma-classes`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  return res.json();
}
