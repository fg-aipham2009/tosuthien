/**
 * Same-origin API: browser → nginx → http://127.0.0.1:8000
 * (vite.dev also proxies /api → localhost:8000)
 */
export const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.replace(/\/$/, '') ?? ''

export const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : '/api'

/** Rewrite absolute api host media URLs to same-origin paths. */
export function toSameOriginMediaUrl(url: string): string {
  if (!url) return url
  try {
    const u = new URL(
      url,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
    )
    if (
      u.hostname === 'api.tosuthien.net' ||
      u.hostname === '127.0.0.1' ||
      u.hostname === 'localhost'
    ) {
      return `${u.pathname}${u.search}${u.hash}`
    }
    return url
  } catch {
    return url
  }
}
