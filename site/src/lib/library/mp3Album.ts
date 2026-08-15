import {
  fetchMediaCategories,
  fetchMp3Folders,
  fetchMp3Tracks,
  fetchMp3Years,
} from "./api";
import type { MediaCategory, Mp3Track } from "./types";

export type Mp3AlbumData = {
  cat: MediaCategory | null;
  folders: string[];
  tracks: Mp3Track[];
  years: number[];
  folder: string | null;
};

/** Load album chrome + playlist in parallel (no sequential waterfall). */
export async function loadMp3Album(opts: {
  slug: string;
  folder?: string | null;
  year?: number | null;
}): Promise<Mp3AlbumData> {
  const folder = opts.folder?.trim() || null;
  const year = opts.year ?? null;

  const [cats, years, folders, tracks] = await Promise.all([
    fetchMediaCategories(),
    fetchMp3Years({
      category: opts.slug,
      folder: folder ?? undefined,
    }),
    fetchMp3Folders({
      category: opts.slug,
      year: year ?? undefined,
    }),
    folder
      ? fetchMp3Tracks({
          category: opts.slug,
          folder,
          year: year ?? undefined,
        })
      : Promise.resolve([] as Mp3Track[]),
  ]);

  const cat = cats.find((c) => c.slug === opts.slug) ?? null;

  if (folder || folders.length !== 1) {
    return { cat, folders, tracks, years, folder };
  }

  const only = folders[0];
  const autoTracks = await fetchMp3Tracks({
    category: opts.slug,
    folder: only,
    year: year ?? undefined,
  });
  return {
    cat,
    folders,
    tracks: autoTracks,
    years,
    folder: only,
  };
}
