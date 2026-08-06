"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchPdfs, fetchTextBooks } from "../../lib/library/api";
import type { BookPdf, TextBook } from "../../lib/library/types";
import { LoadingBlock } from "../ui/Spinner";

type Mode = "text" | "pdf" | "shelf";

const FLIP_SHELF_SRC =
  process.env.NEXT_PUBLIC_FLIPHTML5_SHELF_URL?.trim() ||
  "https://fliphtml5.com/bookcase/smonj/red";

function modeFromQuery(raw: string | null): Mode {
  if (raw === "pdf") return "pdf";
  if (raw === "shelf") return "shelf";
  return "text";
}

function hrefForMode(mode: Mode): string {
  if (mode === "pdf") return "/kinh-sach?mode=pdf";
  if (mode === "shelf") return "/kinh-sach?mode=shelf";
  return "/kinh-sach";
}

function coverStyle(index: number): React.CSSProperties {
  const hue = [18, 28, 8, 35, 14, 22, 12, 30][index % 8];
  return {
    background: `linear-gradient(155deg, hsl(${hue} 32% 42%) 0%, hsl(${hue} 38% 22%) 100%)`,
  };
}

function tabClass(active: boolean) {
  return `rounded-full px-3.5 py-2 text-sm font-semibold transition sm:px-4 ${
    active ? "bg-white text-primary shadow-sm" : "text-white/80 hover:text-white"
  }`;
}

export function KinhSachGrid() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() =>
    modeFromQuery(searchParams.get("mode")),
  );
  const touched = useRef(false);

  const [pdfs, setPdfs] = useState<BookPdf[]>([]);
  const [texts, setTexts] = useState<TextBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** Giữ iframe sau lần mở đầu — tránh flash / tải lại mỗi lần đổi tab. */
  const [shelfMounted, setShelfMounted] = useState(
    () => modeFromQuery(searchParams.get("mode")) === "shelf",
  );

  useEffect(() => {
    if (touched.current) return;
    setMode(modeFromQuery(searchParams.get("mode")));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([fetchPdfs(), fetchTextBooks()])
      .then(([p, t]) => {
        if (cancelled) return;
        setPdfs(p);
        setTexts(t);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Không tải được kinh sách");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function go(next: Mode) {
    touched.current = true;
    setMode(next);
    if (next === "shelf") setShelfMounted(true);
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", hrefForMode(next));
    }
  }

  const items = mode === "pdf" ? pdfs : texts;
  const subtitle =
    mode === "pdf"
      ? "PDF gốc — giữ đúng trang sách in, phóng to / tìm chữ."
      : mode === "shelf"
        ? "Kệ sách 3D (FlipHTML5) — lật sách như trên bản cũ; chỉ tải khi mở tab này."
        : "Đọc chữ — từng trang rõ ràng, chỉnh cỡ chữ, mở nhanh.";

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-[12px] bg-gradient-to-br from-primary-deep via-primary to-secondary px-5 py-5 text-white shadow-lg shadow-primary/20 sm:px-7 lg:mb-6 lg:px-8 lg:py-6">
        <div className="max-w-xl">
          <p className="mb-1 text-[0.72rem] font-semibold tracking-[0.1em] uppercase opacity-75">
            Thư viện
          </p>
          <h2 className="font-serif text-3xl font-bold tracking-tight lg:text-4xl">
            Kinh sách
          </h2>
          <p className="mt-2 text-[0.95rem] leading-relaxed opacity-90">
            {subtitle}
          </p>
        </div>

        <div
          className="inline-grid min-w-[min(100%,280px)] grid-cols-3 gap-1 rounded-full bg-black/25 p-1"
          role="tablist"
          aria-label="Chế độ đọc"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "text"}
            className={tabClass(mode === "text")}
            onClick={() => go("text")}
          >
            Đọc chữ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "pdf"}
            className={tabClass(mode === "pdf")}
            onClick={() => go("pdf")}
          >
            Bản gốc
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "shelf"}
            className={tabClass(mode === "shelf")}
            onClick={() => go("shelf")}
          >
            Kệ 3D
          </button>
        </div>
      </header>

      <div
        className={mode === "shelf" ? "block" : "hidden"}
        aria-hidden={mode !== "shelf"}
      >
        <div className="overflow-hidden rounded-[12px] border border-line bg-paper-warm">
          {shelfMounted ? (
            <iframe
              title="Kệ sách FlipHTML5"
              src={FLIP_SHELF_SRC}
              className="h-[min(80vh,900px)] w-full border-0"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : null}
          <p className="px-4 py-3 text-center text-sm text-muted">
            Kệ 3D từ FlipHTML5. Ảnh bìa nét / đọc nhanh — dùng{" "}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => go("pdf")}
            >
              Bản gốc
            </button>{" "}
            hoặc{" "}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => go("text")}
            >
              Đọc chữ
            </button>
            .
          </p>
        </div>
      </div>

      <div className={mode === "shelf" ? "hidden" : "block"}>
        {!loading && !error ? (
          <div className="mb-4 flex items-center justify-between text-sm text-muted">
            <span>
              {items.length} sách · {mode === "text" ? "Đọc chữ" : "Bản gốc PDF"}
            </span>
          </div>
        ) : null}

        {loading ? (
          <LoadingBlock label="Đang tải danh sách kinh sách…" />
        ) : error ? (
          <p className="py-12 text-center text-alert">{error}</p>
        ) : !items.length ? (
          <p className="py-12 text-center text-muted">Chưa có sách.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {items.map((b, i) => (
              <li key={b.id}>
                <Link
                  href={
                    mode === "pdf"
                      ? `/kinh-sach/pdf/${b.id}`
                      : `/kinh-sach/chu/${b.id}`
                  }
                  className="group flex h-full flex-col gap-2.5"
                >
                  <div
                    className="relative aspect-[3/4.2] overflow-hidden rounded-[12px] bg-paper-warm shadow-md shadow-primary/15 transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-primary/25"
                    style={b.coverImageUrl ? undefined : coverStyle(i)}
                  >
                    {b.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.coverImageUrl}
                        alt={b.title}
                        className="absolute inset-0 size-full rounded-none object-contain"
                        decoding="async"
                        loading={i < 8 ? "eager" : "lazy"}
                      />
                    ) : null}
                    <span className="absolute top-2.5 left-2.5 z-[1] rounded-md bg-black/40 px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide text-white backdrop-blur-sm">
                      {mode === "pdf" ? "PDF" : "Aa"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 px-0.5">
                    <strong className="line-clamp-2 text-[0.9rem] leading-snug font-bold text-ink">
                      {b.title}
                    </strong>
                    {b.lastPage ? (
                      <span className="text-[0.78rem] font-semibold text-primary">
                        Đọc dở · tr.{b.lastPage}
                      </span>
                    ) : (
                      <span className="text-[0.78rem] text-muted">
                        {b.pageCount
                          ? `${b.pageCount} trang`
                          : mode === "pdf"
                            ? "PDF gốc"
                            : "Đọc chữ"}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
