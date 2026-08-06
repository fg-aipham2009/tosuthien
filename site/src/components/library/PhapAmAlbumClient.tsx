"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchMediaCategories,
  fetchMp3Folders,
  fetchMp3Tracks,
  fetchMp3Years,
} from "../../lib/library/api";
import type { MediaCategory, Mp3Track } from "../../lib/library/types";

function folderDisplayName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path || "Thư mục";
}

type Props = { slug: string };

export function PhapAmAlbumClient({ slug }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folder = searchParams.get("folder")?.trim() || null;
  const yearParam = searchParams.get("year");
  const selectedYear =
    yearParam && Number.isFinite(Number(yearParam)) ? Number(yearParam) : null;

  const [cat, setCat] = useState<MediaCategory | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [tracks, setTracks] = useState<Mp3Track[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<Mp3Track | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const cats = await fetchMediaCategories();
      const found = cats.find((c) => c.slug === slug) ?? null;
      setCat(found);
      const y = await fetchMp3Years({
        category: slug,
        folder: folder ?? undefined,
      });
      setYears(y);
      const folderList = await fetchMp3Folders({
        category: slug,
        year: selectedYear ?? undefined,
      });
      setFolders(folderList);

      if (!folder && folderList.length === 1) {
        router.replace(`/phap-am/${slug}?folder=${encodeURIComponent(folderList[0])}`);
        return;
      }

      if (folder) {
        const t = await fetchMp3Tracks({
          category: slug,
          folder,
          year: selectedYear ?? undefined,
        });
        setTracks(t);
      } else {
        setTracks([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [slug, folder, selectedYear, router]);

  useEffect(() => {
    void load();
  }, [load]);

  function playTrack(track: Mp3Track) {
    setCurrent(track);
    requestAnimationFrame(() => {
      const a = audioRef.current;
      if (a) {
        a.src = track.publicUrl;
        void a.play().catch(() => {});
      }
    });
  }

  if (loading) {
    return <p className="py-12 text-center text-muted">Đang tải…</p>;
  }
  if (error) {
    return <p className="py-12 text-center text-alert">{error}</p>;
  }
  if (!cat) {
    return <p className="py-12 text-center text-muted">Không tìm thấy album.</p>;
  }

  return (
    <div className="pb-28">
      <Link href="/phap-am" className="text-sm font-semibold text-primary hover:underline">
        ← Pháp Âm
      </Link>
      <h2 className="mt-4 text-2xl font-bold text-black">{cat.name}</h2>

      {years.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              router.push(
                folder
                  ? `/phap-am/${slug}?folder=${encodeURIComponent(folder)}`
                  : `/phap-am/${slug}`,
              )
            }
            className={`rounded-full px-3 py-1 text-sm ${selectedYear == null ? "bg-primary text-white" : "border border-line"}`}
          >
            Tất cả
          </button>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() =>
                router.push(
                  folder
                    ? `/phap-am/${slug}?folder=${encodeURIComponent(folder)}&year=${y}`
                    : `/phap-am/${slug}?year=${y}`,
                )
              }
              className={`rounded-full px-3 py-1 text-sm ${selectedYear === y ? "bg-primary text-white" : "border border-line"}`}
            >
              {y}
            </button>
          ))}
        </div>
      ) : null}

      {!folder ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {folders.map((path) => (
            <li key={path}>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/phap-am/${slug}?folder=${encodeURIComponent(path)}${selectedYear != null ? `&year=${selectedYear}` : ""}`,
                  )
                }
                className="w-full rounded-[10px] border border-line bg-white px-4 py-3 text-left font-semibold hover:border-primary"
              >
                {folderDisplayName(path)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-6 space-y-2">
          {tracks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => playTrack(t)}
                className={`w-full rounded-[10px] border px-4 py-3 text-left transition ${
                  current?.id === t.id
                    ? "border-primary bg-paper-warm"
                    : "border-line bg-white hover:border-primary"
                }`}
              >
                <span className="font-medium text-black">{t.title}</span>
                {t.year ? (
                  <span className="ml-2 text-sm text-muted">{t.year}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-white px-4 py-3 shadow-lg">
        <p className="mb-1 truncate text-sm font-semibold text-black">
          {current?.title ?? "Chọn bài để nghe"}
        </p>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={audioRef} controls className="w-full" />
      </div>
    </div>
  );
}
