"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type Slide = {
  src: string;
  href: string;
  alt?: string;
};

const AUTOPLAY_MS = 4000;

/** Slider trang chủ — autoplay 4s, kéo được, mũi tên + chấm trang. */
export function HeroSlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragStart = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => setIndex((next + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => go(index + 1), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [index, paused, go]);

  return (
    <div
      className="group relative mb-8 overflow-hidden rounded-[10px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        dragStart.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (dragStart.current === null) return;
        const dx = e.changedTouches[0].clientX - dragStart.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        dragStart.current = null;
      }}
    >
      <div
        className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <Link
            key={slide.src}
            href={slide.href}
            className="relative aspect-video w-full shrink-0 overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.src}
              alt={slide.alt ?? ""}
              className={`h-full w-full rounded-none object-cover transition-transform duration-[8000ms] ease-out ${
                i === index ? "scale-105" : "scale-100"
              }`}
            />
          </Link>
        ))}
      </div>

      <button
        type="button"
        aria-label="Ảnh trước"
        onClick={() => go(index - 1)}
        className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-2xl text-white opacity-0 transition hover:bg-black/45 focus:opacity-100 group-hover:opacity-100 md:opacity-100"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Ảnh kế"
        onClick={() => go(index + 1)}
        className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-2xl text-white opacity-0 transition hover:bg-black/45 focus:opacity-100 group-hover:opacity-100 md:opacity-100"
      >
        ›
      </button>

      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Ảnh ${i + 1}`}
            onClick={() => go(i)}
            className={`h-2.5 w-2.5 rounded-full border border-white transition ${
              i === index ? "bg-white" : "bg-white/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
