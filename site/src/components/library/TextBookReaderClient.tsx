"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  fetchTextBookPages,
  fetchTextBooks,
  saveReadingProgress,
} from "../../lib/library/api";
import type { TextBook, TextBookPage } from "../../lib/library/types";

type Props = { id: string };

export function TextBookReaderClient({ id }: Props) {
  const [book, setBook] = useState<TextBook | null>(null);
  const [pages, setPages] = useState<TextBookPage[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [fontScale, setFontScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWindow = useCallback(
    async (center: number) => {
      const from = Math.max(1, center - 5);
      const to = center + 14;
      const data = await fetchTextBookPages(id, from, to);
      setPageCount(data.pageCount);
      setPages(data.pages);
      setBook((prev) =>
        prev
          ? { ...prev, title: data.title, pageCount: data.pageCount }
          : {
              id,
              title: data.title,
              pageCount: data.pageCount,
            },
      );
    },
    [id],
  );

  useEffect(() => {
    setLoading(true);
    fetchTextBooks()
      .then(async (all) => {
        const hit = all.find((b) => b.id === id) ?? null;
        if (!hit) {
          setError("Không tìm thấy sách");
          return;
        }
        setBook(hit);
        const start = hit.lastPage && hit.lastPage >= 1 ? hit.lastPage : 1;
        setPage(start);
        await loadWindow(start);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải sách"))
      .finally(() => setLoading(false));
  }, [id, loadWindow]);

  useEffect(() => {
    void loadWindow(page).catch(() => {});
  }, [page, loadWindow]);

  useEffect(() => {
    if (book?.pdfFileId) {
      void saveReadingProgress(book.pdfFileId, page).catch(() => {});
    }
  }, [book?.pdfFileId, page]);

  const current = pages.find((p) => p.page === page);
  const body =
    current?.text?.trim() ||
    (current?.isBlank ? "(Trang trống)" : "Đang tải trang…");

  if (loading && !book) {
    return <p className="py-12 text-center text-muted">Đang tải…</p>;
  }
  if (error) {
    return <p className="py-12 text-center text-alert">{error}</p>;
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <Link href="/kinh-sach" className="text-sm font-semibold text-primary">
        ← Kinh sách
      </Link>
      <h2 className="text-xl font-bold">{book?.title}</h2>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded border border-line px-3 py-1 text-sm disabled:opacity-40"
        >
          Trước
        </button>
        <span className="text-sm">
          Trang {page}
          {pageCount ? ` / ${pageCount}` : ""}
        </span>
        <button
          type="button"
          disabled={pageCount > 0 && page >= pageCount}
          onClick={() => setPage((p) => (pageCount ? Math.min(pageCount, p + 1) : p + 1))}
          className="rounded border border-line px-3 py-1 text-sm disabled:opacity-40"
        >
          Sau
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          Cỡ chữ
          <input
            type="range"
            min={0.9}
            max={2.2}
            step={0.1}
            value={fontScale}
            onChange={(e) => setFontScale(Number(e.target.value))}
          />
        </label>
      </div>
      <article
        className="flex-1 whitespace-pre-wrap rounded-[10px] border border-line bg-white p-6 leading-relaxed text-black"
        style={{ fontSize: `${fontScale}rem` }}
      >
        {body}
      </article>
    </div>
  );
}
