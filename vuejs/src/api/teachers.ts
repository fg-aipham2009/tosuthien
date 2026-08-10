import http from './http';
import type { Teacher, TeacherFormData } from '@/types/models';

export async function fetchTeachers(all = true): Promise<Teacher[]> {
  const { data } = await http.get<Teacher[]>('/teachers', {
    params: all ? { all: 'true' } : undefined,
  });
  return data;
}

export async function fetchTeacher(id: string): Promise<Teacher> {
  const { data } = await http.get<Teacher>(`/teachers/${id}`);
  return data;
}

export async function createTeacher(payload: TeacherFormData): Promise<Teacher> {
  const { data } = await http.post<Teacher>('/teachers', payload);
  return data;
}

export async function updateTeacher(
  id: string,
  payload: Partial<TeacherFormData>,
): Promise<Teacher> {
  const { data } = await http.put<Teacher>(`/teachers/${id}`, payload);
  return data;
}

export async function deleteTeacher(id: string): Promise<void> {
  await http.delete(`/teachers/${id}`);
}

export async function uploadTeacherPhoto(id: string, file: File): Promise<Teacher> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await http.post<Teacher>(`/upload/teachers/${id}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function clearTeacherPhoto(id: string): Promise<Teacher> {
  const { data } = await http.delete<Teacher>(`/upload/teachers/${id}/photo`);
  return data;
}
