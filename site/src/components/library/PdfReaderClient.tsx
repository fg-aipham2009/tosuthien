"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchPdfs, saveReadingProgress } from "../../lib/library/api";
import type { BookPdf } from "../../lib/library/types";
import { LoadingBlock } from "../ui/Spinner";

const PdfFlipBook = dynamic(
  () =>
    import("./PdfFlipBook").then((m) => ({ default: m.PdfFlipBook })),
  {
    ssr: false,
    loading: () => (
      <p className="py-20 text-center text-sm text-white/70">
        Đang chuẩn bị lật sách…
      </p>
    ),
  },
);

type Props = { id: string; initialPage?: number };
type ViewMode = "classic" | "flip";

export function PdfReaderClient({ id, initialPage }: Props) {
  const [book, setBook] = useState<BookPdf | null>(null);
  const [page, setPage] = useState(
    initialPage && initialPage >= 1 ? initialPage : 1,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  /** Classic iframe first — light/fast; optional flipbook on demand. */
  const [mode, setMode] = useState<ViewMode>("classic");
  const [jump, setJump] = useState("");

  useEffect(() => {
    fetchPdfs()
      .then((all) => {
        const hit = all.find((b) => b.id === id) ?? null;
        setBook(hit);
        if (!hit) setError("Không tìm thấy sách");
        else if (!initialPage && hit.lastPage) setPage(hit.lastPage);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải PDF"))
      .finally(() => setLoading(false));
  }, [id, initialPage]);

  useEffect(() => {
    if (book) void saveReadingProgress(book.id, page).catch(() => {});
  }, [book, page]);

  const maxPage = book?.pageCount ?? null;

  function clamp(n: number) {
    const max = maxPage ?? n;
    return Math.min(max, Math.max(1, n));
  }

  function goJump() {
    const n = Number(jump);
    if (!Number.isFinite(n)) return;
    setPage(clamp(n));
    setJump("");
  }

  if (loading) return <LoadingBlock label="Đang mở PDF…" />;
  if (error || !book) {
    return (
      <p className="py-12 text-center text-alert">
        {error || "Không tìm thấy sách"}
      </p>
    );
  }

  const classicSrc = `${book.publicUrl}#page=${page}`;

  return (
    <div className="flex min-h-[70vh] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/kinh-sach?mode=pdf"
          className="text-sm font-semibold text-primary"
        >
          ← Bản gốc
        </Link>
        <div className="flex items-center gap-2">
          <div
            className="inline-grid grid-cols-2 gap-0.5 rounded-full bg-paper-warm p-0.5"
            role="tablist"
            aria-label="Chế độ xem"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "classic"}
              onClick={() => setMode("classic")}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                mode === "classic"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              PDF nhanh
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "flip"}
              onClick={() => setMode("flip")}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                mode === "flip"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Lật sách
            </button>
          </div>
        </div>
      </div>

      <h2 className="font-serif text-xl font-bold tracking-tight lg:text-2xl">
        {book.title}
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPage((p) => clamp(p - 1))}
          className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-semibold text-primary disabled:opacity-40"
          disabled={page <= 1}
        >
          Trước
        </button>
        <label className="inline-flex items-center gap-1.5 text-sm text-muted">
          Trang
          <input
            className="w-14 rounded-lg border border-line bg-white px-2 py-1 text-ink"
            value={jump || String(page)}
            onChange={(e) => setJump(e.target.value)}
            onBlur={goJump}
            onKeyDown={(e) => {
              if (e.key === "Enter") goJump();
            }}
            inputMode="numeric"
          />
          {maxPage ? <span>/ {maxPage}</span> : null}
        </label>
        <button
          type="button"
          onClick={() => setPage((p) => clamp(p + 1))}
          className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-semibold text-primary disabled:opacity-40"
          disabled={!!maxPage && page >= maxPage}
        >
          Sau
        </button>
        <a
          className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-semibold text-primary"
          href={book.publicUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mở tab mới
        </a>
      </div>

      {mode === "flip" ? (
        <div className="overflow-hidden rounded-[14px] border border-line bg-[radial-gradient(ellipse_at_center,#5a3424_0%,#2a1510_55%,#1a0c08_100%)] px-2 py-6 shadow-lg shadow-primary/20 sm:px-4 sm:py-8">
          <PdfFlipBook
            url={book.publicUrl}
            page={page}
            onPageChange={(p) => setPage(clamp(p))}
          />
        </div>
      ) : (
        <iframe
          title={book.title}
          src={classicSrc}
          className="min-h-[75vh] w-full flex-1 rounded-[10px] border border-line bg-white"
        />
      )}
    </div>
  );
}
