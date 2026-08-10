import http from './http';
import type {
  ClassAnnouncement,
  ClassAnnouncementFormData,
  DharmaClass,
  DharmaClassFormData,
} from '@/types/models';

export async function fetchDharmaClasses(all = true): Promise<DharmaClass[]> {
  const { data } = await http.get<DharmaClass[]>('/dharma-classes', {
    params: all ? { all: 'true' } : undefined,
  });
  return data;
}

export async function updateDharmaClass(
  id: string,
  payload: DharmaClassFormData,
): Promise<DharmaClass> {
  const { data } = await http.put<DharmaClass>(`/dharma-classes/${id}`, payload);
  return data;
}

export async function fetchClassAnnouncements(params?: {
  all?: boolean;
  classId?: string;
}): Promise<ClassAnnouncement[]> {
  const { data } = await http.get<ClassAnnouncement[]>('/class-announcements', {
    params: {
      all: params?.all ? 'true' : undefined,
      classId: params?.classId || undefined,
    },
  });
  return data;
}

export async function fetchClassAnnouncement(id: string): Promise<ClassAnnouncement> {
  const { data } = await http.get<ClassAnnouncement>(`/class-announcements/${id}`);
  return data;
}

export async function createClassAnnouncement(
  payload: ClassAnnouncementFormData,
): Promise<ClassAnnouncement> {
  const { data } = await http.post<ClassAnnouncement>('/class-announcements', payload);
  return data;
}

export async function updateClassAnnouncement(
  id: string,
  payload: Partial<ClassAnnouncementFormData>,
): Promise<ClassAnnouncement> {
  const { data } = await http.put<ClassAnnouncement>(
    `/class-announcements/${id}`,
    payload,
  );
  return data;
}

export async function deleteClassAnnouncement(id: string): Promise<void> {
  await http.delete(`/class-announcements/${id}`);
}

export async function uploadAnnouncementTeacherPhoto(
  id: string,
  file: File,
): Promise<ClassAnnouncement> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await http.post<ClassAnnouncement>(
    `/upload/class-announcements/${id}/teacher-photo`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function clearAnnouncementTeacherPhoto(
  id: string,
): Promise<ClassAnnouncement> {
  const { data } = await http.delete<ClassAnnouncement>(
    `/upload/class-announcements/${id}/teacher-photo`,
  );
  return data;
}
