/** Đường dẫn file trên VPS — chỉ 3 loại media */
export const MEDIA_DIRS = {
  pdf: 'pdf',
  mp3: 'mp3',
  images: 'images',
} as const;

export function mp3PublicPath(storagePath: string): string {
  return `${MEDIA_DIRS.mp3}/${storagePath.replace(/^\/+/, '')}`;
}

export function imagePublicPath(relativePath: string): string {
  return `${MEDIA_DIRS.images}/${relativePath.replace(/^\/+/, '')}`;
}
