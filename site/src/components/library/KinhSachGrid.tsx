"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchPdfs, fetchTextBooks } from "../../lib/library/api";
import type { BookPdf, TextBook } from "../../lib/library/types";
import { LoadingBlock } from "../ui/Spinner";

type Mode = "text" | "pdf" | "shelf";

/** Kệ sách 3D FlipHTML5 hiện có trên tosuthien.com — chỉ tải khi mở tab (không nặng trang chính). */
const FLIP_SHELF_SRC =
  process.env.NEXT_PUBLIC_FLIPHTML5_SHELF_URL?.trim() ||
  "https://fliphtml5.com/bookcase/smonj/red";

function coverStyle(index: number): React.CSSProperties {
  const hue = [18, 28, 8, 35, 14, 22, 12, 30][index % 8];
  return {
    background: `linear-gradient(155deg, hsl(${hue} 32% 42%) 0%, hsl(${hue} 38% 22%) 100%)`,
  };
}

export function KinhSachGrid() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("mode");
  const mode: Mode =
    raw === "pdf" ? "pdf" : raw === "shelf" ? "shelf" : "text";

  const [pdfs, setPdfs] = useState<BookPdf[]>([]);
  const [texts, setTexts] = useState<TextBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** Lazy: chỉ mount iframe FlipHTML5 sau khi user mở tab kệ sách. */
  const [shelfReady, setShelfReady] = useState(false);

  useEffect(() => {
    if (mode === "shelf") {
      setShelfReady(true);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    Promise.all([fetchPdfs(), fetchTextBooks()])
      .then(([p, t]) => {
        setPdfs(p);
        setTexts(t);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Không tải được kinh sách"),
      )
      .finally(() => setLoading(false));
  }, [mode]);

  function setMode(next: Mode) {
    const href =
      next === "pdf"
        ? "/kinh-sach?mode=pdf"
        : next === "shelf"
          ? "/kinh-sach?mode=shelf"
          : "/kinh-sach";
    router.replace(href);
  }

  const items = mode === "pdf" ? pdfs : texts;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[10px] bg-primary px-5 py-5 text-white">
        <div>
          <p className="text-sm uppercase opacity-80">Thư viện</p>
          <h2 className="text-2xl font-bold">Kinh sách</h2>
          <p className="mt-1 text-sm opacity-90">
            {mode === "pdf"
              ? "PDF gốc — giữ đúng trang sách in, ảnh bìa nét."
              : mode === "shelf"
                ? "Kệ sách 3D (FlipHTML5) — lật sách đẹp; chỉ tải khi bạn mở tab này."
                : "Đọc chữ — từng trang, chỉnh cỡ chữ."}
          </p>
        </div>
        <div className="inline-flex flex-wrap rounded-full bg-black/25 p-1">
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "text" ? "bg-white text-primary" : "text-white/80"}`}
          >
            Đọc chữ
          </button>
          <button
            type="button"
            onClick={() => setMode("pdf")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "pdf" ? "bg-white text-primary" : "text-white/80"}`}
          >
            Bản gốc
          </button>
          <button
            type="button"
            onClick={() => setMode("shelf")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "shelf" ? "bg-white text-primary" : "text-white/80"}`}
          >
            Kệ 3D
          </button>
        </div>
      </div>

      {mode === "shelf" ? (
        <div className="overflow-hidden rounded-[10px] border border-line bg-paper-warm">
          {!shelfReady ? (
            <LoadingBlock label="Đang mở kệ sách 3D…" />
          ) : (
            <iframe
              title="Kệ sách FlipHTML5"
              src={FLIP_SHELF_SRC}
              className="h-[min(80vh,900px)] w-full border-0"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
          <p className="px-4 py-3 text-center text-sm text-muted">
            Kệ 3D chạy trên FlipHTML5 (CDN ngoài). Muốn đọc nhanh / ảnh bìa nét — dùng tab{" "}
            <button type="button" className="font-semibold text-primary" onClick={() => setMode("pdf")}>
              Bản gốc
            </button>{" "}
            hoặc{" "}
            <button type="button" className="font-semibold text-primary" onClick={() => setMode("text")}>
              Đọc chữ
            </button>
            .
          </p>
        </div>
      ) : loading ? (
        <LoadingBlock label="Đang tải danh sách kinh sách…" />
      ) : error ? (
        <p className="py-12 text-center text-alert">{error}</p>
      ) : !items.length ? (
        <p className="py-12 text-center text-muted">Chưa có sách.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((b, i) => (
            <li key={b.id}>
              <Link
                href={
                  mode === "pdf"
                    ? `/kinh-sach/pdf/${b.id}`
                    : `/kinh-sach/chu/${b.id}`
                }
                className="group flex flex-col gap-2"
              >
                <div
                  className="relative aspect-[3/4.2] overflow-hidden rounded-[10px] bg-paper-warm p-3 text-white shadow-md"
                  style={b.coverImageUrl ? undefined : coverStyle(i)}
                >
                  {b.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.coverImageUrl}
                      alt=""
                      className="absolute inset-0 size-full object-contain transition duration-500 group-hover:scale-[1.02]"
                      decoding="async"
                    />
                  ) : null}
                  <span className="relative z-[1] rounded bg-black/35 px-1.5 py-0.5 text-xs font-bold backdrop-blur-sm">
                    {mode === "pdf" ? "PDF" : "Aa"}
                  </span>
                </div>
                <strong className="line-clamp-2 text-sm font-bold">{b.title}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
