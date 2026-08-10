import http from './http';
import type {
  PaginatedPosts,
  Post,
  PostCategory,
  PostCategoryFormData,
  PostFormData,
} from '@/types/models';

export async function fetchPosts(params?: {
  all?: boolean;
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}): Promise<PaginatedPosts> {
  const { data } = await http.get<PaginatedPosts>('/posts', {
    params: {
      all: params?.all ? 'true' : undefined,
      page: params?.page,
      limit: params?.limit,
      search: params?.search?.trim() || undefined,
      category: params?.category || undefined,
    },
  });
  return data;
}

export async function fetchPost(id: string): Promise<Post> {
  const { data } = await http.get<Post>(`/posts/${id}`);
  return data;
}

export async function createPost(payload: PostFormData): Promise<Post> {
  const { data } = await http.post<Post>('/posts', payload);
  return data;
}

export async function updatePost(id: string, payload: Partial<PostFormData>): Promise<Post> {
  const { data } = await http.put<Post>(`/posts/${id}`, payload);
  return data;
}

export async function deletePost(id: string): Promise<void> {
  await http.delete(`/posts/${id}`);
}

export async function fetchPostCategories(): Promise<PostCategory[]> {
  const { data } = await http.get<PostCategory[]>('/posts/categories');
  return data;
}

export async function createPostCategory(payload: PostCategoryFormData): Promise<PostCategory> {
  const { data } = await http.post<PostCategory>('/posts/categories', payload);
  return data;
}

export async function updatePostCategory(
  id: string,
  payload: Partial<PostCategoryFormData>,
): Promise<PostCategory> {
  const { data } = await http.put<PostCategory>(`/posts/categories/${id}`, payload);
  return data;
}

export async function deletePostCategory(id: string): Promise<void> {
  await http.delete(`/posts/categories/${id}`);
}

export async function uploadPostCover(id: string, file: File): Promise<Post> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await http.post<Post>(`/upload/posts/${id}/cover`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function clearPostCoverImage(id: string): Promise<Post> {
  const { data } = await http.delete<Post>(`/posts/${id}/cover-image`);
  return data;
}

/** Set cover from an existing URL (e.g. teacher photo), without re-upload. */
export async function setPostCoverUrl(id: string, url: string): Promise<Post> {
  const { data } = await http.put<Post>(`/posts/${id}/cover-image`, { url });
  return data;
}

export async function uploadPostImages(id: string, files: File[]): Promise<Post> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const { data } = await http.post<Post>(`/upload/posts/${id}/images`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deletePostImage(postId: string, imageId: string): Promise<Post> {
  const { data } = await http.delete<Post>(`/posts/${postId}/images/${imageId}`);
  return data;
}
