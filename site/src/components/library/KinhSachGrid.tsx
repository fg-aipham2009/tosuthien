"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchPdfs, fetchTextBooks } from "../../lib/library/api";
import type { BookPdf, TextBook } from "../../lib/library/types";
import { LoadingBlock } from "../ui/Spinner";

type Mode = "text" | "pdf";

function coverStyle(index: number): React.CSSProperties {
  const hue = [18, 28, 8, 35, 14, 22, 12, 30][index % 8];
  return {
    background: `linear-gradient(155deg, hsl(${hue} 32% 42%) 0%, hsl(${hue} 38% 22%) 100%)`,
  };
}

export function KinhSachGrid() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: Mode = searchParams.get("mode") === "pdf" ? "pdf" : "text";

  const [pdfs, setPdfs] = useState<BookPdf[]>([]);
  const [texts, setTexts] = useState<TextBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
  }, []);

  function setMode(next: Mode) {
    router.replace(next === "pdf" ? "/kinh-sach?mode=pdf" : "/kinh-sach");
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
              ? "PDF gốc — giữ đúng trang sách in."
              : "Đọc chữ — từng trang, chỉnh cỡ chữ."}
          </p>
        </div>
        <div className="inline-flex rounded-full bg-black/25 p-1">
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
        </div>
      </div>

      {loading ? (
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
                  className="relative aspect-[3/4.2] overflow-hidden rounded-[10px] p-3 text-white shadow-md"
                  style={b.coverImageUrl ? undefined : coverStyle(i)}
                >
                  {b.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.coverImageUrl}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : null}
                  <span className="relative z-[1] text-xs font-bold">
                    {mode === "pdf" ? "PDF" : "Aa"}
                  </span>
                  <span className="relative z-[1] mt-auto line-clamp-4 text-sm font-semibold">
                    {b.title}
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
