"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchPdfs, saveReadingProgress } from "../../lib/library/api";
import type { BookPdf } from "../../lib/library/types";
import { LoadingBlock } from "../ui/Spinner";

type Props = { id: string; initialPage?: number };

export function PdfReaderClient({ id, initialPage }: Props) {
  const [book, setBook] = useState<BookPdf | null>(null);
  const [page, setPage] = useState(initialPage && initialPage >= 1 ? initialPage : 1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  if (loading) return <LoadingBlock label="Đang mở PDF…" />;
  if (error || !book) {
    return (
      <p className="py-12 text-center text-alert">{error || "Không tìm thấy sách"}</p>
    );
  }

  const src = `${book.publicUrl}#page=${page}`;

  return (
    <div className="flex min-h-[70vh] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/kinh-sach?mode=pdf" className="text-sm font-semibold text-primary">
          ← Bản gốc
        </Link>
        <span className="rounded-full bg-paper-warm px-3 py-1 text-xs font-bold text-primary">
          PDF
        </span>
      </div>
      <h2 className="text-xl font-bold">{book.title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPage((p) => clamp(p - 1))}
          className="rounded border border-line px-3 py-1 text-sm"
        >
          Trước
        </button>
        <span className="text-sm">
          Trang {page}
          {maxPage ? ` / ${maxPage}` : ""}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => clamp(p + 1))}
          className="rounded border border-line px-3 py-1 text-sm"
        >
          Sau
        </button>
      </div>
      <iframe
        title={book.title}
        src={src}
        className="min-h-[75vh] w-full flex-1 rounded-[10px] border border-line bg-white"
      />
    </div>
  );
}
