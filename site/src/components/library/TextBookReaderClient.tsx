"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPdfs,
  fetchTextBookPages,
  fetchTextBooks,
  saveReadingProgress,
} from "../../lib/library/api";
import {
  isContentPage,
  layoutTextPage,
  mergePageWindows,
} from "../../lib/library/textBookPage";
import type { TextBook, TextBookPage } from "../../lib/library/types";
import { LoadingBlock } from "../ui/Spinner";

type Props = { id: string };

const FONT_MIN = 0.95;
const FONT_MAX = 2.8;
const FONT_STEP = 0.1;
const FONT_DEFAULT = 1.52;

/**
 * Đọc chữ — logic giống portal BookTextView (tosuthien.net):
 * - Bỏ trang trống đầu sách (blankPages / firstContentPage)
 * - Trước/Sau từng trang trong [firstContentPage, pageCount]
 * - Header OCR + reflow đoạn; A−/A+; lưu tiến độ theo PDF liên kết
 */
export function TextBookReaderClient({ id }: Props) {
  const [book, setBook] = useState<TextBook | null>(null);
  const [pages, setPages] = useState<TextBookPage[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [firstContentPage, setFirstContentPage] = useState(1);
  const [page, setPage] = useState(1);
  const [fontScale, setFontScale] = useState(FONT_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfId, setPdfId] = useState<string | null>(null);
  const pagesRef = useRef<TextBookPage[]>([]);
  const firstRef = useRef(1);
  const countRef = useRef(0);
  pagesRef.current = pages;
  firstRef.current = firstContentPage;
  countRef.current = pageCount;

  const clampToContent = useCallback((n: number) => {
    const max = countRef.current || Number.POSITIVE_INFINITY;
    return Math.min(max, Math.max(firstRef.current, n));
  }, []);

  const loadWindow = useCallback(
    async (center: number) => {
      const from = Math.max(1, center - 5);
      const to = center + 14;
      const data = await fetchTextBookPages(id, from, to);
      setPageCount(data.pageCount);
      countRef.current = data.pageCount;
      setPages((prev) => {
        const next = mergePageWindows(prev, data.pages);
        pagesRef.current = next;
        return next;
      });
      setBook((prev) =>
        prev
          ? { ...prev, title: data.title, pageCount: data.pageCount }
          : { id, title: data.title, pageCount: data.pageCount },
      );
      return data;
    },
    [id],
  );

  const resolveFirstContentPage = useCallback(
    async (hintBlank: number) => {
      const hint = Math.max(1, hintBlank + 1);
      const probeTo = Math.min(countRef.current || hint + 20, hint + 24);
      await loadWindow(hint);
      const hit = pagesRef.current.find((p) => p.page >= hint && isContentPage(p));
      if (hit) return hit.page;

      const data = await fetchTextBookPages(id, 1, probeTo);
      setPageCount(data.pageCount);
      countRef.current = data.pageCount;
      setPages((prev) => {
        const next = mergePageWindows(prev, data.pages);
        pagesRef.current = next;
        return next;
      });
      const first = data.pages.find((p) => isContentPage(p));
      return first?.page ?? hint;
    },
    [id, loadWindow],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [texts, pdfs] = await Promise.all([fetchTextBooks(), fetchPdfs()]);
        const hit = texts.find((b) => b.id === id) ?? null;
        if (!hit) {
          setError("Không tìm thấy sách chữ");
          return;
        }
        if (cancelled) return;
        setBook(hit);
        setPageCount(hit.pageCount || 0);
        countRef.current = hit.pageCount || 0;

        const first = await resolveFirstContentPage(hit.blankPages ?? 0);
        if (cancelled) return;
        setFirstContentPage(first);
        firstRef.current = first;

        const saved = hit.lastPage || 0;
        const start = saved >= first ? saved : first;
        setPage(start);

        const stem = id;
        setPdfId(
          hit.pdfFileId ??
            pdfs.find(
              (p) =>
                String(p.sortOrder) === stem ||
                p.slug === stem ||
                p.filename?.replace(/\.pdf$/i, "") === stem,
            )?.id ??
            null,
        );

        if (!pagesRef.current.some((p) => p.page === start)) {
          await loadWindow(start);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Lỗi tải trang");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount per id
  }, [id]);

  // Giống portal watch(page): clamp + load window nếu thiếu trang + lưu tiến độ.
  useEffect(() => {
    if (!book) return;
    const clamped = clampToContent(page);
    if (clamped !== page) {
      setPage(clamped);
      return;
    }
    let cancelled = false;
    (async () => {
      if (!pagesRef.current.some((x) => x.page === page)) {
        setLoading(true);
        try {
          await loadWindow(page);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      if (pdfId) void saveReadingProgress(pdfId, page).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [page, book, pdfId, clampToContent, loadWindow]);

  const current = pages.find((p) => p.page === page);
  const pageLayout = useMemo(() => layoutTextPage(current), [current]);

  function prev() {
    setPage((p) => clampToContent(p - 1));
  }

  function next() {
    setPage((p) => clampToContent(p + 1));
  }

  if (error) {
    return <p className="px-4 py-8 text-alert sm:px-6">{error}</p>;
  }

  if (loading && !book) {
    return <LoadingBlock label="Đang tải…" />;
  }

  return (
    <div className="-mx-[15px] flex min-h-full w-[calc(100%+30px)] flex-col sm:-mx-4 sm:w-[calc(100%+2rem)] lg:-mx-6 lg:w-[calc(100%+3rem)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-black/10 bg-white px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/kinh-sach"
          className="text-sm font-semibold text-primary hover:underline"
        >
          ← Đọc chữ
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-base font-bold sm:text-lg">
            {book?.title || "Đọc chữ"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-40"
            disabled={page <= firstContentPage}
            onClick={prev}
          >
            Trước
          </button>
          <span className="min-w-16 text-center text-sm font-semibold">
            {page} / {pageCount || "…"}
          </span>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-40"
            disabled={pageCount > 0 && page >= pageCount}
            onClick={next}
          >
            Sau
          </button>
          <button
            type="button"
            className="size-8 rounded-lg border border-black/10 bg-white font-bold text-primary"
            title="Thu nhỏ"
            onClick={() =>
              setFontScale((s) => Math.max(FONT_MIN, +(s - FONT_STEP).toFixed(2)))
            }
          >
            A−
          </button>
          <button
            type="button"
            className="size-8 rounded-lg border border-black/10 bg-white font-bold text-primary"
            title="Phóng to"
            onClick={() =>
              setFontScale((s) => Math.min(FONT_MAX, +(s + FONT_STEP).toFixed(2)))
            }
          >
            A+
          </button>
        </div>
      </div>

      {loading ? (
        <p className="px-4 py-8 text-muted sm:px-6 lg:px-8">Đang tải…</p>
      ) : (
        <article
          className="min-h-[70vh] flex-1 bg-gradient-to-b from-[#fffdf9] to-[#f3ebe3] px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 xl:px-16"
          style={{ fontSize: `${fontScale}rem` }}
        >
          {pageLayout.label ? (
            <header className="mb-5 flex items-baseline justify-between gap-4 border-b border-primary/15 pb-2.5 font-serif text-[0.92em] tracking-wide text-primary">
              <span className="min-w-0 flex-1">{pageLayout.label}</span>
              <span className="shrink-0 tabular-nums font-semibold">
                {pageLayout.pageLabel}
              </span>
            </header>
          ) : null}
          <div className="w-full max-w-none font-serif leading-[1.85] break-words whitespace-pre-wrap text-[#2a211c]">
            {pageLayout.body}
          </div>
        </article>
      )}
    </div>
  );
}
