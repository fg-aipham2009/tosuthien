"use client";

import { useEffect, useState } from "react";
import { LoadingBlock, Spinner } from "./Spinner";

/**
 * Shows spinner only after `delayMs` — avoids flash on fast navigations,
 * still appears when API/RSC work takes long.
 */
export function DelayedLoadingBlock({
  label = "Đang tải…",
  delayMs = 320,
  className = "",
  minHeightClass = "min-h-[280px]",
}: {
  label?: string;
  delayMs?: number;
  className?: string;
  minHeightClass?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  if (!show) {
    return (
      <div
        className={`${minHeightClass} ${className}`}
        aria-hidden
      />
    );
  }

  return <LoadingBlock label={label} className={className} />;
}

/** Compact delayed spinner (inline / section). */
export function DelayedSpinner({
  label = "Đang tải",
  delayMs = 320,
  size = "md" as const,
}: {
  label?: string;
  delayMs?: number;
  size?: "sm" | "md" | "lg";
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  if (!show) return null;
  return <Spinner size={size} label={label} />;
}
