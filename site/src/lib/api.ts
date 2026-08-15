import type { Center, CenterRegion } from "./types";

const LOOPBACK_API = "http://127.0.0.1:8000";

const publicApi = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.tosuthien.net"
).replace(/\/$/, "");

/**
 * Origin used only for server→Nest fetches on the VPS.
 * Never expose this in user-facing HTML (browsers cannot open VPS loopback).
 */
function serverFetchOrigin(): string {
  const fromEnv = process.env.API_INTERNAL_BASE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return LOOPBACK_API;
  return publicApi;
}

/**
 * User-facing origin for /files links.
 * Empty = same-origin (nginx proxies /files → Nest localhost).
 */
export const API_ORIGIN = "";

/**
 * Client: `/api` (nginx → 127.0.0.1:8000).
 * Server: `http://127.0.0.1:8000/api`
 */
export const API_BASE =
  typeof window !== "undefined" ? "/api" : `${serverFetchOrigin()}/api`;

/** Rewrite absolute api.tosuthien.net media URLs to same-origin paths. */
export function toSameOriginMediaUrl(url: string): string {
  if (!url) return url;
  try {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://tosuthien.com";
    const u = new URL(url, base);
    if (
      u.hostname === "api.tosuthien.net" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "localhost"
    ) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    return url;
  } catch {
    return url;
  }
}

export async function fetchCenters(region?: CenterRegion | ""): Promise<Center[]> {
  const qs = region ? `?region=${encodeURIComponent(region)}` : "";
  const res = await fetch(`${API_BASE}/centers${qs}`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) throw new Error(`Không tải được danh sách thiền đường (${res.status})`);
  return res.json();
}

export async function fetchCenterBySlug(slug: string): Promise<Center | null> {
  const res = await fetch(`${API_BASE}/centers/slug/${encodeURIComponent(slug)}`, {
    next: { revalidate: 120 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Không tải được thiền đường (${res.status})`);
  return res.json();
}
