import type { Mp3Track } from "./types";

function safeFilename(name: string, fallbackExt = "mp3") {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
  if (!cleaned) return `track.${fallbackExt}`;
  return cleaned.toLowerCase().endsWith(`.${fallbackExt}`)
    ? cleaned
    : `${cleaned}.${fallbackExt}`;
}

/** Download one track as .mp3 (fetch → blob for correct filename cross-origin). */
export async function downloadTrackMp3(track: Mp3Track): Promise<void> {
  const res = await fetch(track.publicUrl);
  if (!res.ok) throw new Error(`Tải thất bại (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename(track.filename || track.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function folderDisplayName(folderPath: string): string {
  const parts = folderPath.replace(/\/+$/, "").split("/").filter(Boolean);
  return parts[parts.length - 1] || folderPath || "Thư mục";
}

/** Hide placeholder year from UI / filters. */
export const HIDDEN_MP3_YEAR = 1990;

export function filterMp3Years(years: number[]): number[] {
  return years.filter((y) => y !== HIDDEN_MP3_YEAR);
}

export function showMp3Year(year?: number | null): boolean {
  return year != null && year !== HIDDEN_MP3_YEAR;
}
