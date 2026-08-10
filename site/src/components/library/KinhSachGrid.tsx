"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchPdfs, fetchTextBooks } from "../../lib/library/api";
import type { BookPdf, TextBook } from "../../lib/library/types";
import { LoadingBlock } from "../ui/Spinner";

type Mode = "shelf" | "text" | "pdf";

const FLIP_SHELF_SRC =
  process.env.NEXT_PUBLIC_FLIPHTML5_SHELF_URL?.trim() ||
  "https://fliphtml5.com/bookcase/smonj/red";

function modeFromQuery(raw: string | null): Mode {
  if (raw === "pdf") return "pdf";
  if (raw === "text") return "text";
  return "shelf";
}

function hrefForMode(mode: Mode): string {
  if (mode === "pdf") return "/kinh-sach?mode=pdf";
  if (mode === "text") return "/kinh-sach?mode=text";
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
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listLoaded, setListLoaded] = useState(false);

  useEffect(() => {
    if (touched.current) return;
    setMode(modeFromQuery(searchParams.get("mode")));
  }, [searchParams]);

  /** Only fetch book lists when leaving the FlipHTML5 shelf. */
  useEffect(() => {
    if (mode === "shelf" || listLoaded) return;
    let cancelled = false;
    setListLoading(true);
    setListError("");
    Promise.all([fetchPdfs(), fetchTextBooks()])
      .then(([p, t]) => {
        if (cancelled) return;
        setPdfs(p);
        setTexts(t);
        setListLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setListError(e instanceof Error ? e.message : "Không tải được kinh sách");
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, listLoaded]);

  function go(next: Mode) {
    touched.current = true;
    setMode(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", hrefForMode(next));
    }
  }

  const items = mode === "pdf" ? pdfs : texts;
  const subtitle =
    mode === "shelf"
      ? "Kệ sách FlipHTML5 — chọn sách và lật trang ngay, nhẹ và dễ dùng."
      : mode === "pdf"
        ? "PDF gốc trên máy chủ — phóng to, tìm chữ, mở tab mới."
        : "Đọc chữ — từng trang rõ, chỉnh cỡ chữ.";

  return (
    <div className="min-h-[min(50vh,560px)]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-[12px] bg-gradient-to-br from-primary-deep via-primary to-secondary px-5 py-5 text-white shadow-lg shadow-primary/20 sm:px-7 lg:mb-6 lg:px-8 lg:py-6">
        <div className="max-w-xl">
          <p className="mb-1 text-[0.72rem] font-semibold tracking-[0.1em] uppercase opacity-75">
            Thư viện
          </p>
          <h2 className="font-serif text-3xl font-bold tracking-tight lg:text-4xl">
            Kinh sách
          </h2>
          <p className="mt-2 text-[1.02rem] leading-relaxed opacity-90 sm:text-base">
            {subtitle}
          </p>
        </div>

        <div
          className="inline-grid min-w-[min(100%,300px)] grid-cols-3 gap-1 rounded-full bg-black/25 p-1"
          role="tablist"
          aria-label="Chế độ đọc"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "shelf"}
            className={tabClass(mode === "shelf")}
            onClick={() => go("shelf")}
          >
            FlipHTML5
          </button>
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
        </div>
      </header>

      {mode === "shelf" ? (
        <div className="overflow-hidden rounded-[12px] border border-line bg-paper-warm">
          <iframe
            title="Kệ sách FlipHTML5"
            src={FLIP_SHELF_SRC}
            className="min-h-[min(72vh,640px)] h-[min(88vh,960px)] w-full border-0 sm:min-h-[560px]"
            allowFullScreen
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <p className="px-4 py-3 text-center text-sm text-muted">
            Đọc nhanh trên kệ 3D. Cần tìm chữ / đọc dở trên máy chủ — dùng{" "}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => go("text")}
            >
              Đọc chữ
            </button>{" "}
            hoặc{" "}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => go("pdf")}
            >
              Bản gốc
            </button>
            .
          </p>
        </div>
      ) : (
        <div>
          {!listLoading && !listError ? (
            <div className="mb-4 flex items-center justify-between text-sm text-muted">
              <span>
                {items.length} sách · {mode === "text" ? "Đọc chữ" : "Bản gốc PDF"}
              </span>
            </div>
          ) : null}

          {listLoading ? (
            <LoadingBlock label="Đang tải danh sách kinh sách…" />
          ) : listError ? (
            <p className="py-12 text-center text-alert">{listError}</p>
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
                      <strong className="line-clamp-2 text-sm leading-snug font-bold text-ink sm:text-base">
                        {b.title}
                      </strong>
                      {b.lastPage ? (
                        <span className="text-sm font-semibold text-primary">
                          Đọc dở · tr.{b.lastPage}
                        </span>
                      ) : (
                        <span className="text-sm text-muted">
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
      )}
    </div>
  );
}
