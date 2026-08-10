"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMp3Player } from "../../hooks/useMp3Player";
import {
  fetchMediaCategories,
  fetchMp3Folders,
  fetchMp3Tracks,
  fetchMp3Years,
} from "../../lib/library/api";
import {
  downloadTrackMp3,
  filterMp3Years,
  folderDisplayName,
  showMp3Year,
} from "../../lib/library/mp3Download";
import type { MediaCategory, Mp3Track } from "../../lib/library/types";
import { DelayedLoadingBlock } from "../ui/DelayedLoading";

function DownloadIcon({ spinning }: { spinning?: boolean }) {
  if (spinning) {
    return (
      <svg
        className="animate-spin"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v10m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  const [yearsRaw, setYearsRaw] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const player = useMp3Player();

  const years = useMemo(() => filterMp3Years(yearsRaw), [yearsRaw]);
  const isSingleFolder = folders.length === 1;

  const filteredFolders = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = folders.map((path) => ({
      path,
      name: folderDisplayName(path),
    }));
    const list = s
      ? rows.filter(
          (f) =>
            f.name.toLowerCase().includes(s) ||
            f.path.toLowerCase().includes(s),
        )
      : rows;
    return list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [folders, q]);

  const filteredTracks = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return tracks;
    return tracks.filter((t) => t.title.toLowerCase().includes(s));
  }, [tracks, q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const cats = await fetchMediaCategories();
      setCat(cats.find((c) => c.slug === slug) ?? null);
      const y = await fetchMp3Years({
        category: slug,
        folder: folder ?? undefined,
      });
      setYearsRaw(y);
      const folderList = await fetchMp3Folders({
        category: slug,
        year: selectedYear ?? undefined,
      });
      setFolders(folderList);

      if (!folder && folderList.length === 1) {
        router.replace(
          `/phap-am/${slug}?folder=${encodeURIComponent(folderList[0])}`,
        );
        return;
      }

      if (folder) {
        setTracks(
          await fetchMp3Tracks({
            category: slug,
            folder,
            year: selectedYear ?? undefined,
          }),
        );
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

  function yearQuery() {
    return selectedYear != null ? `&year=${selectedYear}` : "";
  }

  function pushYear(year: number | null) {
    if (folder) {
      router.push(
        year != null
          ? `/phap-am/${slug}?folder=${encodeURIComponent(folder)}&year=${year}`
          : `/phap-am/${slug}?folder=${encodeURIComponent(folder)}`,
      );
    } else {
      router.push(
        year != null ? `/phap-am/${slug}?year=${year}` : `/phap-am/${slug}`,
      );
    }
  }

  function playAt(list: Mp3Track[], i: number) {
    const track = list[i];
    if (!track) return;
    if (player.isTrackActive(track.id)) {
      player.toggle();
      return;
    }
    player.playQueue(list, i);
  }

  async function onDownload(t: Mp3Track, e: React.MouseEvent) {
    e.stopPropagation();
    if (downloadingId) return;
    setDownloadingId(t.id);
    try {
      await downloadTrackMp3(t);
    } catch {
      /* browser may show error */
    } finally {
      setDownloadingId(null);
    }
  }

  function backToFolders() {
    setQ("");
    if (isSingleFolder) {
      router.push("/phap-am");
      return;
    }
    router.push(`/phap-am/${slug}`);
  }

  if (loading) {
    return <DelayedLoadingBlock label="Đang tải pháp âm…" />;
  }
  if (error) {
    return <p className="py-12 text-center text-alert">{error}</p>;
  }
  if (!cat) {
    return <p className="py-12 text-center text-muted">Không tìm thấy album.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl pb-32">
      <Link href="/phap-am" className="text-sm font-semibold text-primary hover:underline">
        ← Pháp Âm
      </Link>
      <h2 className="mt-2 text-2xl font-bold text-black lg:text-3xl">{cat.name}</h2>

      {folder && !isSingleFolder ? (
        <p className="mb-4 text-sm text-muted">
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={backToFolders}
          >
            ← Thư mục
          </button>
          <span className="mx-1.5 text-black/20">/</span>
          <span>{folderDisplayName(folder)}</span>
        </p>
      ) : !folder ? (
        <p className="mb-4 text-sm text-muted">
          Chọn thư mục để nghe — có thể tải từng bài MP3.
        </p>
      ) : null}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder={folder ? "Tìm trong thư mục…" : "Tìm thư mục…"}
        className="mb-4 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-primary/40"
      />

      {years.length > 1 ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Lọc theo năm
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => pushYear(null)}
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                selectedYear == null
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-white hover:border-primary/30"
              }`}
            >
              Tất cả
            </button>
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => pushYear(y)}
                className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                  selectedYear === y
                    ? "border-primary bg-primary text-white"
                    : "border-line bg-white hover:border-primary/30"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!folder ? (
        <ul className="space-y-2">
          {filteredFolders.length === 0 ? (
            <p className="text-muted">Không có thư mục nào.</p>
          ) : (
            filteredFolders.map(({ path, name }) => (
              <li key={path}>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/phap-am/${slug}?folder=${encodeURIComponent(path)}${yearQuery()}`,
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 text-left transition hover:border-primary/30 hover:shadow-sm"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <FolderIcon />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-semibold text-black">
                      {name}
                    </span>
                    <span className="text-xs text-muted">Mở thư mục</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">{filteredTracks.length} bài</p>
          {filteredTracks.length === 0 ? (
            <p className="text-muted">Không có bài nào.</p>
          ) : (
            <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {filteredTracks.map((t, i) => {
                const active = player.isTrackActive(t.id);
                const playing = active && player.state.playing;
                return (
                  <li key={t.id}>
                    <div
                      className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-1 px-3 py-2.5 transition hover:bg-paper-warm ${
                        active ? "bg-paper-warm/80" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="font-serif text-primary"
                        aria-label={`Phát ${t.title}`}
                        onClick={() => playAt(filteredTracks, i)}
                      >
                        {active && playing ? "♪" : i + 1}
                      </button>
                      <button
                        type="button"
                        className="min-w-0 p-0 text-left leading-snug"
                        onClick={() => playAt(filteredTracks, i)}
                      >
                        <span
                          className={`block truncate ${active ? "font-semibold text-primary" : "font-medium text-black"}`}
                        >
                          {t.title}
                        </span>
                        {showMp3Year(t.year) ? (
                          <span className="text-xs text-muted">{t.year}</span>
                        ) : null}
                        {active ? (
                          <span className="ml-2 text-xs font-semibold text-primary">
                            {playing ? "Đang phát" : "Tạm dừng"}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                        disabled={downloadingId === t.id}
                        title="Tải về"
                        aria-label="Tải về"
                        onClick={(e) => void onDownload(t, e)}
                      >
                        <DownloadIcon spinning={downloadingId === t.id} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
