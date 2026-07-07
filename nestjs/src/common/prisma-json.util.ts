import { Prisma } from '@prisma/client';
import { GalleryImage } from './gallery-image.interface';

function isGalleryImage(value: unknown): value is GalleryImage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'url' in value &&
    typeof (value as GalleryImage).url === 'string'
  );
}

/** Prisma Json column → GalleryImage[] */
export function parseGalleryImages(json: Prisma.JsonValue): GalleryImage[] {
  if (!Array.isArray(json)) return [];
  const result: GalleryImage[] = [];
  for (const item of json) {
    if (isGalleryImage(item)) result.push(item);
  }
  return result;
}

/** GalleryImage[] → Prisma Json input */
export function galleryImagesToJson(images: GalleryImage[]): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(images)) as Prisma.InputJsonValue;
}
