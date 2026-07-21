import http from './http';
import type { Center, CenterFormData, Course, CourseFormData } from '@/types/models';

export async function fetchCenters(all = true): Promise<Center[]> {
  const { data } = await http.get<Center[]>('/centers', { params: { all: all ? 'true' : undefined } });
  return data;
}

export async function fetchCenter(id: string): Promise<Center> {
  const { data } = await http.get<Center>(`/centers/${id}`);
  return data;
}

export async function createCenter(payload: CenterFormData): Promise<Center> {
  const { data } = await http.post<Center>('/centers', payload);
  return data;
}

export async function updateCenter(id: string, payload: Partial<CenterFormData>): Promise<Center> {
  const { data } = await http.put<Center>(`/centers/${id}`, payload);
  return data;
}

export async function deleteCenter(id: string): Promise<void> {
  await http.delete(`/centers/${id}`);
}

export async function uploadCenterMain(id: string, file: File): Promise<Center> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await http.post<Center>(`/upload/centers/${id}/main`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function clearCenterMainImage(id: string): Promise<Center> {
  const { data } = await http.delete<Center>(`/centers/${id}/main-image`);
  return data;
}

export async function uploadCenterGallery(id: string, files: File[]): Promise<Center> {
  if (files.length === 1) {
    const form = new FormData();
    form.append('file', files[0]);
    const { data } = await http.post<Center>(`/upload/centers/${id}/gallery`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const { data } = await http.post<Center>(`/upload/centers/${id}/gallery/batch`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function removeGalleryImage(id: string, url: string): Promise<Center> {
  const { data } = await http.delete<Center>(`/centers/${id}/gallery`, { data: { url } });
  return data;
}

export async function fetchCourses(centerId?: string): Promise<Course[]> {
  const { data } = await http.get<Course[]>('/courses', {
    params: centerId ? { center_id: centerId } : undefined,
  });
  return data;
}

export async function createCourse(payload: CourseFormData): Promise<Course> {
  const { data } = await http.post<Course>('/courses', payload);
  return data;
}

export async function updateCourse(id: string, payload: Partial<CourseFormData>): Promise<Course> {
  const { data } = await http.put<Course>(`/courses/${id}`, payload);
  return data;
}

export async function deleteCourse(id: string): Promise<void> {
  await http.delete(`/courses/${id}`);
}
