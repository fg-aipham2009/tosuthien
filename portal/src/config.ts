/** API origin for browser (no trailing slash). */
export const API_ORIGIN =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://api.tosuthien.net'

export const API_BASE = `${API_ORIGIN}/api`
