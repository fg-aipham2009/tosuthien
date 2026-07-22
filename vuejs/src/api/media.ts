import http from './http';
import type {
  MediaCategory,
  Mp3Track,
  YoutubeFormData,
  YoutubeVideo,
} from '@/types/models';

export async function fetchCategories(): Promise<MediaCategory[]> {
  const { data } = await http.get<MediaCategory[]>('/media/categories');
  return data;
}

export async function fetchMp3Tracks(params?: {
  folder?: string;
  category?: string;
  year?: number;
  all?: boolean;
}): Promise<Mp3Track[]> {
  const { data } = await http.get<Mp3Track[]>('/mp3/tracks', {
    params: {
      folder: params?.folder,
      category: params?.category,
      year: params?.year,
      all: params?.all ? 'true' : undefined,
    },
  });
  return data;
}

export async function deleteMp3Track(id: string): Promise<void> {
  await http.delete(`/mp3/tracks/${id}`);
}

export async function updateMp3Track(
  id: string,
  payload: {
    title?: string;
    year?: number;
    categoryId?: string;
    description?: string | null;
    isPublished?: boolean;
    sortOrder?: number;
  },
): Promise<Mp3Track> {
  const { data } = await http.put<Mp3Track>(`/mp3/tracks/${id}`, payload);
  return data;
}

export async function fetchYoutubeVideos(params?: {
  category?: string;
  all?: boolean;
}): Promise<YoutubeVideo[]> {
  const { data } = await http.get<YoutubeVideo[]>('/youtube/videos', {
    params: {
      category: params?.category,
      all: params?.all ? 'true' : undefined,
    },
  });
  return data;
}

export async function createYoutube(payload: YoutubeFormData): Promise<YoutubeVideo> {
  const { data } = await http.post<YoutubeVideo>('/youtube/videos', payload);
  return data;
}

export async function updateYoutube(
  id: string,
  payload: Partial<YoutubeFormData>,
): Promise<YoutubeVideo> {
  const { data } = await http.put<YoutubeVideo>(`/youtube/videos/${id}`, payload);
  return data;
}

export async function deleteYoutube(id: string): Promise<void> {
  await http.delete(`/youtube/videos/${id}`);
}

/** Extract YouTube video ID from URL or raw ID. */
export function parseYoutubeId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  try {
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
    const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(`https://${trimmed}`);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace(/^\//, '').slice(0, 11);
    }
    const v = url.searchParams.get('v');
    if (v) return v.slice(0, 11);
    const embed = url.pathname.match(/\/embed\/([\w-]{11})/);
    if (embed) return embed[1];
  } catch {
    return trimmed.slice(0, 11);
  }
  return trimmed;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeThumbUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}
