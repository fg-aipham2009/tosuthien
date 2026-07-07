import http from './http';
import type { FolderListing, MediaRoot } from '@/types/models';

export async function fetchFileRoots(): Promise<string[]> {
  const { data } = await http.get<string[]>('/files/roots');
  return data;
}

export async function listFolder(root: MediaRoot, path = ''): Promise<FolderListing> {
  const { data } = await http.get<FolderListing>('/files/list', { params: { root, path } });
  return data;
}

export async function createFolder(root: MediaRoot, folderPath: string): Promise<FolderListing> {
  const { data } = await http.post<FolderListing>('/files/folders', { root, path: folderPath });
  return data;
}

export async function deleteFile(root: MediaRoot, filePath: string): Promise<void> {
  await http.delete('/files', { params: { root, path: filePath } });
}

export async function uploadPdf(file: File, title?: string): Promise<unknown> {
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  const { data } = await http.post('/upload/pdf', form);
  return data;
}

export async function uploadImages(folderPath: string, files: File[]): Promise<unknown> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  form.append('folderPath', folderPath);
  const { data } = await http.post('/upload/images/batch', form);
  return data;
}

export async function uploadMp3Batch(
  files: File[],
  opts: { categoryId: string; year: number; folderPath: string },
): Promise<{ count: number; tracks: unknown[] }> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  form.append('categoryId', opts.categoryId);
  form.append('year', String(opts.year));
  form.append('folderPath', opts.folderPath);
  const { data } = await http.post('/upload/mp3/batch', form);
  return data;
}
