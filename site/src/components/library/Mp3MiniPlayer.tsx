"use client";

import { useEffect, useState } from "react";
import { useMp3Player } from "../../hooks/useMp3Player";

export function Mp3MiniPlayer() {
  const {
    state,
    current,
    progress,
    queueLabel,
    hasPrev,
    hasNext,
    toggle,
    next,
    prev,
    seekRatio,
    toggleShuffle,
    cycleRepeat,
    stopAndClose,
    formatTime,
  } = useMp3Player();

  const [scrub, setScrub] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  useEffect(() => {
    if (!scrubbing) setScrub(progress);
  }, [progress, scrubbing]);

  if (!current) return null;

  const pct = Math.round((scrubbing ? scrub : progress) * 1000) / 10;
  const seekBg = {
    background: `linear-gradient(to right, #8d6e63 0%, #8d6e63 ${pct}%, rgba(255,255,255,0.18) ${pct}%, rgba(255,255,255,0.18) 100%)`,
  };

  let statusText = "Tạm dừng";
  if (state.loading) statusText = "Đang tải…";
  else if (state.error) statusText = state.error;
  else if (state.playing) {
    statusText = queueLabel ? `Đang phát · ${queueLabel}` : "Đang phát";
  } else if (queueLabel) {
    statusText = `Tạm dừng · ${queueLabel}`;
  }

  const repeatTitle =
    state.repeat === "one"
      ? "Lặp một bài"
      : state.repeat === "all"
        ? "Lặp danh sách"
        : "Không lặp";

  return (
    <div
      className="fixed right-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#2a1810]/96 text-white shadow-2xl backdrop-blur-md lg:right-5 lg:bottom-5 lg:left-auto lg:w-[min(420px,calc(100vw-2.5rem))]"
      role="region"
      aria-label="Trình phát MP3"
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{current.title}</p>
          <p className="truncate text-xs text-white/55">{statusText}</p>
        </div>
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
          title="Tắt trình phát"
          aria-label="Tắt trình phát"
          onClick={stopAndClose}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="px-3 pt-2">
        <input
          className="mp3-seek w-full"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={scrubbing ? scrub : progress}
          style={seekBg}
          disabled={!state.duration || state.loading}
          aria-label="Tua bài"
          onInput={(e) => {
            setScrubbing(true);
            setScrub(Number(e.currentTarget.value));
          }}
          onChange={() => {
            seekRatio(scrub);
            setScrubbing(false);
          }}
          onPointerUp={() => {
            seekRatio(scrub);
            setScrubbing(false);
          }}
        />
        <div className="mt-0.5 flex justify-between text-[0.68rem] text-white/55 tabular-nums">
          <span>
            {formatTime(scrubbing ? scrub * state.duration : state.position)}
          </span>
          <span>{formatTime(state.duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 px-3 pt-1 pb-3">
        <button
          type="button"
          className={`grid size-8 place-items-center rounded-full text-sm font-bold ${
            state.shuffle ? "bg-[#c4a484]/25 text-[#c4a484]" : "text-white/40 hover:text-white/70"
          }`}
          title="Ngẫu nhiên"
          aria-label="Ngẫu nhiên"
          aria-pressed={state.shuffle}
          onClick={toggleShuffle}
        >
          ⇄
        </button>

        <button
          type="button"
          className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5 text-lg text-[#c4a484] disabled:opacity-35"
          aria-label="Bài trước"
          disabled={!hasPrev}
          onClick={prev}
        >
          ‹
        </button>

        <button
          type="button"
          className="grid size-11 place-items-center rounded-full bg-[#c4a484] text-[#2a1810] shadow-md"
          aria-label={state.playing ? "Tạm dừng" : "Phát"}
          onClick={toggle}
        >
          {state.loading ? (
            <svg
              className="animate-spin"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : state.playing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13l11-6.5L8 5.5z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5 text-lg text-[#c4a484] disabled:opacity-35"
          aria-label="Bài sau"
          disabled={!hasNext}
          onClick={next}
        >
          ›
        </button>

        <button
          type="button"
          className={`grid size-8 place-items-center rounded-full text-xs font-bold ${
            state.repeat !== "off"
              ? "bg-[#c4a484]/25 text-[#c4a484]"
              : "text-white/40 hover:text-white/70"
          }`}
          title={repeatTitle}
          aria-label="Lặp lại"
          onClick={cycleRepeat}
        >
          {state.repeat === "one" ? "1" : state.repeat === "all" ? "∞" : "–"}
        </button>
      </div>
    </div>
  );
}
