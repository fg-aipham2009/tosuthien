"use client";

import { useCallback, useEffect, useState } from "react";
import { Reveal } from "./motion/Reveal";

export function CenterGallery({
  urls,
  templeName,
}: {
  urls: string[];
  templeName: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const close = useCallback(() => setActive(null), []);

  useEffect(() => {
    if (active == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") {
        setActive((i) => (i == null ? i : (i + 1) % urls.length));
      }
      if (e.key === "ArrowLeft") {
        setActive((i) =>
          i == null ? i : (i - 1 + urls.length) % urls.length,
        );
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [active, close, urls.length]);

  if (!urls.length) return null;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {urls.map((url, i) => (
          <Reveal key={url} delay={i * 60} variant="zoom">
            <button
              type="button"
              onClick={() => setActive(i)}
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${templeName} — ảnh ${i + 1}`}
                loading={i < 3 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full rounded-none object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
              />
              <span className="pointer-events-none absolute inset-0 bg-primary/0 transition duration-500 group-hover:bg-primary/10" />
            </button>
          </Reveal>
        ))}
      </div>

      {active != null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh lớn"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1a0f0a]/88 p-4 backdrop-blur-sm animate-fade-in"
          onClick={close}
        >
          <button
            type="button"
            aria-label="Đóng"
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl text-white transition hover:bg-white/30"
            onClick={close}
          >
            ×
          </button>
          {urls.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Ảnh trước"
                className="absolute left-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition hover:bg-white/30 md:left-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setActive((i) =>
                    i == null ? i : (i - 1 + urls.length) % urls.length,
                  );
                }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Ảnh kế"
                className="absolute right-3 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition hover:bg-white/30 md:right-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setActive((i) => (i == null ? i : (i + 1) % urls.length));
                }}
              >
                ›
              </button>
            </>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[active]}
            alt={`${templeName} — ảnh ${active + 1}`}
            decoding="async"
            className="max-h-[88vh] max-w-[min(1100px,94vw)] rounded-none object-contain shadow-2xl animate-zoom-in"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
