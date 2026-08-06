import type { Center, CenterRegion } from "./types";

const publicApi = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.tosuthien.net"
).replace(/\/$/, "");

/** SSR/build on VPS: gọi API nội bộ, tránh lỗi TLS khi nginx đang sửa. */
export const API_ORIGIN =
  typeof window === "undefined" && process.env.API_INTERNAL_BASE_URL
    ? process.env.API_INTERNAL_BASE_URL.replace(/\/$/, "")
    : publicApi;

export const API_BASE = `${API_ORIGIN}/api`;

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
