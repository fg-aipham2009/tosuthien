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

/** Published Zoom / schedule rooms for the homepage. */
export async function fetchDharmaClasses(): Promise<DharmaClassBrief[]> {
  const res = await fetch(`${API_BASE}/dharma-classes`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  return res.json();
}
