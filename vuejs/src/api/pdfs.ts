import http from './http';
import type { PdfFile } from '@/types/models';

export async function fetchPdfs(): Promise<PdfFile[]> {
  const { data } = await http.get<PdfFile[]>('/pdfs');
  return data;
}

export async function uploadPdfCover(id: string, file: File): Promise<PdfFile> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await http.post<PdfFile>(`/upload/pdfs/${id}/cover`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function clearPdfCover(id: string): Promise<PdfFile> {
  const { data } = await http.delete<PdfFile>(`/upload/pdfs/${id}/cover`);
  return data;
}
